import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.js';
import {LocalDatabase,LocalImages,migrate} from './storage.mjs';
import {localAssets} from './assets.mjs';
import {configuration,httpServer} from './runtime.mjs';
process.umask(0o077);
const root=fileURLToPath(new URL('../',import.meta.url));
const config=configuration(),data=resolve(process.env.DATA_DIR||'/data');
const DB=new LocalDatabase(join(data,'blog.sqlite'));
await migrate(DB,join(root,'worker/migrations'),join(data,'backups'));
const env={DB,IMAGES:new LocalImages(resolve(process.env.UPLOADS_DIR||'/uploads')),ASSETS:localAssets(join(root,'dist')),ENVIRONMENT:'production'};
const server=httpServer(worker,env,config);
server.listen(config.port,config.host,()=>console.log('Blog listening on port',server.address().port));
let stopping=false;
function stop(){if(stopping)return;stopping=true;const timer=setTimeout(()=>server.closeAllConnections(),10000);timer.unref();server.close(()=>{clearTimeout(timer);DB.close();process.exit(0);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
