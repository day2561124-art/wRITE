export const actors=["Alice","Bob"];
export const goalByCharacter={Alice:"Enter the building",Bob:"Keep the shelter sealed"};
export const initial={simulation_time:"2026-09-13T10:00:00+08:00",world_rules:{default_vision_range_m:30},
 event_queue:[1,2,3].map(i=>({event_id:"event86b-"+i,type:"check_door",scene_id:"scene86b",participants:actors})),
 scenes:{scene86b:{scene_id:"scene86b",dimensions:{width_m:10,depth_m:10},entity_positions:{Alice:{x:0,y:0},Bob:{x:0,y:1},Door:{x:3,y:0}},
 visibility_profiles:Object.fromEntries(actors.map(character=>[character,{facing_degrees:0,horizontal_fov_degrees:120,eye_height_m:1.6,illumination_thresholds_lux:{silhouette_min_lux:1,dim_min_lux:5,clear_min_lux:20}}])),
 perception_labels_by:{Alice:{Door:"A closed door."},Bob:{Door:"A closed door."}},obstacles:[],lighting:{ambient_lux:30},sound_events:[],auditory_labels_by:{}}},
 characters:Object.fromEntries(actors.map(character=>[character,{current_action:"observe",goals:[goalByCharacter[character]],known:[]}])),objects:{Door:{}},memories:{Alice:[],Bob:[]},
 available_actions:Object.fromEntries(actors.map(character=>[character,[{action_id:"wait",intent:"Consider what the closed door means"}]]))};
