import {DatabaseSync, backup} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, linkSync, unlinkSync, lstatSync} from 'node:fs';
import {dirname, join} from 'node:path';

export class LocalDatabase {
  constructor(filename) {
    mkdirSync(dirname(filename), {recursive:true});
    this.native=new DatabaseSync(filename, {timeout:5000});
    this.native.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    // No await inside the transaction: requests cannot interleave on this connection.
    this.native.exec('BEGIN IMMEDIATE');
    try { const results=statements.map(s=>{if(s.owner!==this)throw Error('Foreign statement');return s.execute();});this.native.exec('COMMIT');return results; }
    catch(error) {this.native.exec('ROLLBACK');throw error;}
  }
  close() {this.native.close();}
}
class Statement {
  constructor(owner, sql, values=[]) {this.owner=owner;this.sql=sql;this.values=values;}
  bind(...values) {return new Statement(this.owner,this.sql,values);}
  execute() {
    const db=this.owner.native, statement=db.prepare(this.sql);
    const before=db.prepare('SELECT total_changes() AS n').get().n;
    const results=statement.columns().length ? statement.all(...this.values).map(row=>({...row})) : [];
    let last;
    if(!statement.columns().length)last=statement.run(...this.values);
    const changes=db.prepare('SELECT total_changes() AS n').get().n-before;
    return {success:true,results,meta:{changes,last_row_id:Number(last?.lastInsertRowid??0)}};
  }
  async first(column) {const row=this.execute().results[0]??null;return column&&row ? row[column] : row;}
  async all() {return this.execute();}
  async run() {return this.execute();}
}
export async function migrate(database, directory, backupDirectory) {
  const db=database.native;
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
  const files=readdirSync(directory).filter(n=>/^\d+_[a-z0-9_]+\.sql$/.test(n)).sort();
  const applied=new Map(db.prepare('SELECT name,checksum FROM schema_migrations').all().map(r=>[r.name,r.checksum]));
  for(const name of applied.keys())if(!files.includes(name))throw Error('Applied migration missing: '+name);
  const pending=[];
  for(const name of files) {
    const sql=readFileSync(join(directory,name),'utf8'), checksum=createHash('sha256').update(sql).digest('hex');
    if(applied.has(name)&&applied.get(name)!==checksum)throw Error('Applied migration changed: '+name);
    if(!applied.has(name))pending.push({name,sql,checksum});
  }
  if(pending.length&&applied.size) {
    if(!backupDirectory)throw Error('Migration backup directory required');
    mkdirSync(backupDirectory,{recursive:true});
    await backup(db,join(backupDirectory,'before-migration-'+Date.now()+'-'+randomUUID()+'.sqlite'));
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const {name,sql,checksum} of pending) {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(name,checksum,new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  return pending.length;
}
const imageKey=/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;
const types={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
export class LocalImages {
  constructor(directory) {this.directory=directory;mkdirSync(directory,{recursive:true});}
  path(key) {if(!imageKey.test(key))throw Error('Invalid image key');return join(this.directory,key);}
  async put(key, data, options={}) {
    const target=this.path(key), temp=join(this.directory,'.upload-'+randomUUID());
    const bytes=Buffer.from(data);
    if(bytes.length>5*1024*1024)throw Error('Image too large');
    writeFileSync(temp,bytes,{flag:'wx',mode:0o600});
    try {
      if(options.onlyIf?.etagDoesNotMatch==='*') {
        try {linkSync(temp,target);} catch(error) {if(error.code==='EEXIST')return null;throw error;}
      } else renameSync(temp,target);
      return {key};
    } finally {try{unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}}
  }
  async get(key) {
    const filename=this.path(key);let info;
    try {info=lstatSync(filename);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(!info.isFile()||info.isSymbolicLink())throw Error('Invalid image file');
    const bytes=readFileSync(filename), contentType=types[key.split('.').pop()];
    const etag='"'+createHash('sha256').update(bytes).digest('hex')+'"';
    return {body:bytes,httpEtag:etag,httpMetadata:{contentType},arrayBuffer:async()=>Uint8Array.from(bytes).buffer,
      writeHttpMetadata(headers){headers.set('content-type',contentType);}};
  }
  async list({limit=100,cursor=''}={}) {
    if(cursor&&!imageKey.test(cursor))throw Error('Invalid cursor');
    const keys=readdirSync(this.directory).filter(k=>imageKey.test(k)&&k>cursor&&lstatSync(this.path(k)).isFile()).sort();
    const selected=keys.slice(0,Math.max(1,Math.min(100,limit)));
    return {objects:selected.map(key=>({key,size:lstatSync(this.path(key)).size})),truncated:keys.length>selected.length,cursor:selected.at(-1)};
  }
}
