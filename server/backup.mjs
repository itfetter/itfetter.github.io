// Consistent SQLite snapshot. For a complete backup, also copy uploads while writes are paused.
import {backup} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {mkdirSync,existsSync} from 'node:fs';
import {LocalDatabase} from './storage.mjs';
process.umask(0o077);
const data=resolve(process.env.DATA_DIR||'/data'), directory=join(data,'backups');
mkdirSync(directory,{recursive:true});
const target=join(directory,'manual-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
if(existsSync(target))throw Error('Backup already exists');
const db=new LocalDatabase(join(data,'blog.sqlite'));
try {await backup(db.native,target);console.log('Snapshot saved:',target);}finally{db.close();}
