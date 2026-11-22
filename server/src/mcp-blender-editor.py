# This file is a fixed Blender Lab payload. The caller supplies JSON data only.
def nexa_blender(request):
    import math
    from itertools import islice

    import bmesh
    import bpy
    from mathutils import Euler, Matrix, Quaternion, Vector

    context = bpy.context
    scene = context.scene
    request_id = request["id"]

    def receipt(**kwargs):
        return dict(id=request_id, **kwargs)

    if request["mode"] == "inspect":
        detail = None
        if request["object"] is not None:
            obj = scene.objects.get(request["object"])
            if obj is None:
                return receipt(ok=False, code="BLENDER_EDIT_REJECTED", changed=False, index=None)
            data = obj.data
            mesh = data if obj.type == "MESH" else None
            detail = {
                "name": obj.name, "type": obj.type, "mode": obj.mode,
                "location": list(obj.location), "rotation_mode": obj.rotation_mode,
                "rotation_euler_degrees": [math.degrees(v) for v in obj.rotation_euler] if obj.rotation_mode not in {"QUATERNION", "AXIS_ANGLE"} else None,
                "rotation_quaternion": list(obj.rotation_quaternion) if obj.rotation_mode == "QUATERNION" else None,
                "rotation_axis_angle": list(obj.rotation_axis_angle) if obj.rotation_mode == "AXIS_ANGLE" else None,
                "scale": list(obj.scale), "dimensions": list(obj.dimensions), "hidden": obj.hide_viewport,
                "parent": obj.parent.name if obj.parent else None,
                "collections": [c.name for c in islice(obj.users_collection, 16)],
                "materials": [slot.material.name if slot.material else None for slot in islice(obj.material_slots, 16)],
                "modifiers": [{"name": m.name, "type": m.type} for m in islice(obj.modifiers, 16)],
                "vertex_count": len(mesh.vertices) if mesh is not None else None,
                "vertices": [{"index": v.index, "co": list(v.co)} for v in islice(mesh.vertices, 128)] if mesh is not None else [],
                "camera_lens": data.lens if obj.type == "CAMERA" else None,
                "light": {"type": data.type, "power": data.energy, "color": list(data.color)} if obj.type == "LIGHT" else None,
            }
        return receipt(ok=True, scene=scene.name, scene_id=str(scene.session_uid), camera=scene.camera.name if scene.camera else None,
                       object_count=len(scene.objects),
                       objects=[{"name": o.name, "type": o.type, "selected": o.select_get()}
                                for o in islice(scene.objects, 80)],
                       detail=detail)

    if scene.name != request["scene"] or str(scene.session_uid) != request["scene_id"]:
        return receipt(ok=False, code="BLENDER_SCENE_MISMATCH", changed=False, index=None)
    if context.mode != "OBJECT":
        return receipt(ok=False, code="BLENDER_EDIT_MODE", changed=False, index=None)

    rollback = []
    objects = []
    collections = []

    def set_value(owner, field, value):
        old = getattr(owner, field)
        if isinstance(old, (Euler, Matrix, Quaternion, Vector)):
            old = old.copy()
        rollback.append(lambda: setattr(owner, field, old))
        setattr(owner, field, value)

    def ensure_local(block):
        if block.library is not None or block.override_library is not None:
            raise ValueError("linked or overridden data")

    def target_collection(op):
        if "collection" not in op:
            collection = scene.collection
        else:
            collection = bpy.data.collections.get(op["collection"])
            if collection is None or collection not in list(scene.collection.children_recursive):
                raise ValueError("collection outside current scene")
            if collection.users != 1:
                raise ValueError("collection shared between scenes or parents")
        ensure_local(collection)
        return collection

    def tracked_new(store, item):
        rollback.append(lambda: store.remove(item))
        return item

    def set_transform(obj, op):
        if "location" in op:
            set_value(obj, "location", op["location"])
        if "rotation" in op:
            old_mode = obj.rotation_mode
            old_field = {"QUATERNION": "rotation_quaternion", "AXIS_ANGLE": "rotation_axis_angle"}.get(old_mode, "rotation_euler")
            old_rotation = tuple(getattr(obj, old_field))

            def restore_rotation():
                obj.rotation_mode = old_mode
                setattr(obj, old_field, old_rotation)

            rollback.append(restore_rotation)
            obj.rotation_mode = "XYZ"
            obj.rotation_euler = tuple(math.radians(v) for v in op["rotation"])
        if "scale" in op:
            set_value(obj, "scale", op["scale"])

    def populate_primitive(mesh, kind):
        if kind == "TORUS":
            radial, cross = 32, 12
            vertices = []
            faces = []
            for i in range(radial):
                a = 2 * math.pi * i / radial
                for j in range(cross):
                    b = 2 * math.pi * j / cross
                    r = 1 + .25 * math.cos(b)
                    vertices.append((r * math.cos(a), r * math.sin(a), .25 * math.sin(b)))
                    faces.append((i * cross + j, ((i + 1) % radial) * cross + j,
                                  ((i + 1) % radial) * cross + (j + 1) % cross, i * cross + (j + 1) % cross))
            mesh.from_pydata(vertices, [], faces)
            return
        bm = bmesh.new()
        try:
            if kind == "CUBE":
                bmesh.ops.create_cube(bm, size=2)
            elif kind == "PLANE":
                bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1)
            elif kind == "UV_SPHERE":
                bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
            elif kind == "ICO_SPHERE":
                bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
            else:
                bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=32, radius1=1,
                                      radius2=1 if kind == "CYLINDER" else 0, depth=2)
            bm.to_mesh(mesh)
        finally:
            bm.free()

    def set_light(data, op):
        if "power" in op:
            set_value(data, "energy", op["power"])
        if "color" in op:
            set_value(data, "color", op["color"])
        if "size" in op:
            if data.type == "AREA":
                set_value(data, "size", op["size"])
            elif data.type == "SUN":
                set_value(data, "angle", math.radians(op["size"]))
            else:
                set_value(data, "shadow_soft_size", op["size"])

    def create_object(op):
        kind, name = op["op"], op["name"]
        if bpy.data.objects.get(name) is not None:
            raise ValueError("duplicate object")
        collection = target_collection(op)
        if kind in {"primitive", "mesh"}:
            data = tracked_new(bpy.data.meshes, bpy.data.meshes.new(name))
            if kind == "primitive":
                populate_primitive(data, op["kind"])
            else:
                data.from_pydata(op["vertices"], op.get("edges", []), op["faces"])
                if data.validate(verbose=False):
                    raise ValueError("invalid Blender mesh")
            data.update()
        elif kind == "light":
            data = tracked_new(bpy.data.lights, bpy.data.lights.new(name, op["kind"]))
            set_light(data, op)
        else:
            data = tracked_new(bpy.data.cameras, bpy.data.cameras.new(name))
            if "lens" in op:
                data.lens = op["lens"]
        obj = tracked_new(bpy.data.objects, bpy.data.objects.new(name, data))
        if obj.name != name:
            raise ValueError("name changed")
        collection.objects.link(obj)
        set_transform(obj, op)
        return obj

    def edit_one(op):
        kind, name = op["op"], op["name"]
        if kind == "collection":
            if bpy.data.collections.get(name) is not None:
                raise ValueError("duplicate collection")
            collection = tracked_new(bpy.data.collections, bpy.data.collections.new(name))
            if collection.name != name:
                raise ValueError("name changed")
            scene.collection.children.link(collection)
            collections.append(collection)
            return
        if kind in {"primitive", "mesh", "light", "camera"}:
            objects.append(create_object(op))
            return
        obj = scene.objects.get(name)
        if obj is None:
            raise ValueError("missing object")
        if kind == "active_camera":
            if obj.type != "CAMERA":
                raise ValueError("not a camera")
            ensure_local(scene)
            set_value(scene, "camera", obj)
            objects.append(obj)
            return
        ensure_local(obj)
        if len(obj.users_scene) != 1:
            raise ValueError("object shared between scenes")
        if kind in {"set_light", "set_camera"}:
            if obj.type != {"set_light": "LIGHT", "set_camera": "CAMERA"}[kind]:
                raise ValueError("incorrect object type")
            data = obj.data
            ensure_local(data)
            if data.users != 1:
                raise ValueError("data shared between objects")
            if kind == "set_light":
                set_light(data, op)
            else:
                set_value(data, "lens", op["lens"])
        elif kind == "transform":
            set_transform(obj, op)
        elif kind == "rename":
            if bpy.data.objects.get(op["new_name"]) is not None:
                raise ValueError("duplicate object")
            set_value(obj, "name", op["new_name"])
            if obj.name != op["new_name"]:
                raise ValueError("name changed")
        elif kind == "visibility":
            set_value(obj, "hide_viewport", op["hidden"])
            set_value(obj, "hide_render", op["hidden"])
        else:
            if obj.type != "MESH":
                raise ValueError("not a mesh")
            if kind == "bevel":
                mod_name = op.get("modifier_name", "Nexa Bevel")
                if obj.modifiers.get(mod_name) is not None:
                    raise ValueError("duplicate modifier")
                mod = obj.modifiers.new(mod_name, "BEVEL")
                rollback.append(lambda: obj.modifiers.remove(mod))
                mod.width, mod.segments = op["width"], op["segments"]
            else:
                mesh = obj.data
                ensure_local(mesh)
                if mesh.users != 1:
                    raise ValueError("mesh shared between objects")
                if kind in {"material", "assign_material"}:
                    mat = bpy.data.materials.get(op["material_name"])
                    if kind == "material":
                        if mat is not None:
                            raise ValueError("duplicate material")
                        mat = tracked_new(bpy.data.materials, bpy.data.materials.new(op["material_name"]))
                        if mat.name != op["material_name"]:
                            raise ValueError("name changed")
                        mat.use_nodes = True
                        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                        bsdf.inputs["Base Color"].default_value = op["color"]
                        bsdf.inputs["Roughness"].default_value = op.get("roughness", .5)
                        bsdf.inputs["Metallic"].default_value = op.get("metallic", 0)
                        bsdf.inputs["Alpha"].default_value = op["color"][3]
                        mat.diffuse_color = op["color"]
                    elif mat is None:
                        raise ValueError("missing material")
                    if len(mesh.materials) == 0:
                        mesh.materials.append(mat)
                        rollback.append(lambda: mesh.materials.pop(index=0))
                    else:
                        slot = obj.material_slots[0]
                        set_value(slot, "material", mat)
                elif kind == "vertices":
                    if mesh.shape_keys is not None or any(u["index"] >= len(mesh.vertices) for u in op["updates"]):
                        raise ValueError("invalid vertex edit")
                    rollback.append(mesh.update)
                    for update in op["updates"]:
                        set_value(mesh.vertices[update["index"]], "co", update["co"])
                    mesh.update()
        objects.append(obj)

    index = None
    try:
        ensure_local(scene)
        for index, op in enumerate(request["operations"]):
            edit_one(op)
        context.view_layer.update()
        return receipt(ok=True, changed=True, scene=scene.name, scene_id=str(scene.session_uid), applied=len(request["operations"]),
                       objects=list(dict.fromkeys(o.name for o in objects)),
                       collections=list(dict.fromkeys(c.name for c in collections)))
    except Exception:
        if not rollback:
            return receipt(ok=False, code="BLENDER_EDIT_REJECTED", changed=False, index=index)
        restored = True
        for undo in reversed(rollback):
            try:
                undo()
            except Exception:
                restored = False
        try:
            context.view_layer.update()
        except Exception:
            restored = False
        return receipt(ok=False,
                       code="BLENDER_EDIT_ROLLED_BACK" if restored else "BLENDER_EDIT_ROLLBACK_FAILED",
                       changed=False if restored else None, index=index)


result = nexa_blender(request)
