// Run with docker compose exec (interactive TTY). Passwords never enter argv/env.
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {resolve,join} from 'node:path';
import {hashPassword} from '../worker/auth.js';
import {LocalDatabase} from './storage.mjs';
process.umask(0o077);
if(!process.stdin.isTTY)throw Error('Run in an interactive terminal; passwords must not be passed as arguments or environment variables.');
const db=new LocalDatabase(join(resolve(process.env.DATA_DIR||'/data'),'blog.sqlite'));
let hidden=false;
const output=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk,encoding);done();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try {
  const existing=await db.prepare('SELECT id FROM admin_users WHERE id=1').first();
  if(existing&&!process.argv.includes('--reset'))throw Error('Administrator exists. Use --reset explicitly to replace it and revoke sessions.');
  const username=(await rl.question('Username (3–64 lowercase letters/digits/hyphens): ')).trim();
  if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(username))throw Error('Invalid username');
  process.stdout.write('Password (hidden): ');hidden=true;const password=await rl.question('');hidden=false;process.stdout.write('\n');
  process.stdout.write('Repeat password (hidden): ');hidden=true;const confirmation=await rl.question('');hidden=false;process.stdout.write('\n');
  if(password!==confirmation)throw Error('Passwords differ');
  const hash=await hashPassword(password);
  await db.batch([
    db.prepare('DELETE FROM admin_sessions'),
    db.prepare('INSERT INTO admin_users(id,username,password_hash,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,updated_at=excluded.updated_at').bind(username,hash,new Date().toISOString())
  ]);
  console.log('Administrator saved; all previous sessions revoked.');
}finally{hidden=false;rl.close();db.close();}
