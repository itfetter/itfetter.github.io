const views=new Set(['overview','articles','editor','messages','comments','account','collections']);
const validId=id=>typeof id==='string'&&id.length<=70&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export function readAdminRoute(value){
 const url=new URL(value),view=url.searchParams.get('view');
 if(!views.has(view))return {view:'overview',id:null};
 const id=url.searchParams.get('id');
 if(view==='editor'&&id&&!validId(id))return {view:'articles',id:null};
 return {view,id:view==='editor'&&validId(id)?id:null};
}
export function adminRouteURL(value,view,id){
 const url=new URL(value);url.searchParams.set('view',views.has(view)?view:'overview');
 if(view==='editor'&&validId(id))url.searchParams.set('id',id);else url.searchParams.delete('id');
 if(view!=='collections')url.searchParams.delete('collection');
 url.searchParams.delete('password');return url.pathname+url.search+url.hash;
}
