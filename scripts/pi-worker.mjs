import {createPiDurableWorkerSupervisor} from '../server/src/pi-durable-worker-supervisor.mjs';
const supervisor=createPiDurableWorkerSupervisor({onStatus:status=>process.stdout.write(JSON.stringify(status)+'\n')});
process.once('SIGINT',()=>supervisor.drain());
process.once('SIGTERM',()=>supervisor.drain());
