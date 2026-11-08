import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import * as THREE from "three";
const cache = new Map();
async function moduleUrl(name) {
 if(cache.has(name)) return cache.get(name);
 let js = ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
 for(const match of [...js.matchAll(/from "\.\/(.*?)"/g)]) js=js.replaceAll(`from "./${match[1]}"`, `from "${await moduleUrl(match[1])}"`);
 js=js.replaceAll('from "three"', `from "${import.meta.resolve("three")}"`);
 const url=`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`; cache.set(name,url); return url;
}
const { buildVillage }=await import(await moduleUrl("village"));
const { createNavigation }=await import(await moduleUrl("navigation"));
const load=THREE.TextureLoader.prototype.load;
const previousDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {} }) }) };
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
try {
 const scene=new THREE.Scene(); const { rooms,cafeInterior,cafeExteriorDoor,obstacles }=buildVillage(scene);
 assert.equal(cafeInterior.visible,false,"Interior contents must be hidden outside");
 assert.equal(cafeExteriorDoor.visible,true,"The outside doorway must be closed visually");
 const meshes=[]; rooms.cafe.traverse(object=>{
  if(!object.isMesh) return;
  for(let parent=object;parent;parent=parent.parent) if(!parent.visible) return;
  meshes.push(object);
 });
 scene.updateMatrixWorld(true);
 const target=new THREE.Vector3(21,1.5,-0.7);
 for(const position of [[21,1.5,6],[16,1.5,-0.7],[26,1.5,-0.7],[21,1.5,-5],[21,4.1,7],[21,4.1,-7],[21,8,-0.7],[17.5,0.4,5],[24.5,2.9,5]]) {
  const origin=new THREE.Vector3(...position), direction=target.clone().sub(origin);
  const ray=new THREE.Raycaster(origin,direction.clone().normalize(),0,direction.length());
  assert.ok(ray.intersectObjects(meshes,false).length,`Opaque cafe shell blocks view from ${position}`);
 }
 const navigation=createNavigation(obstacles,{minX:-70,maxX:70,minZ:-92,maxZ:50});
 assert.equal(navigation.isWalkable({x:18.5,z:2.2}),false,"Windows are not entrances");
 assert.equal(navigation.isWalkable({x:23.5,z:2.2}),false);
 assert.equal(navigation.isWalkable({x:21,z:2.2}),true,"The center doorway remains walkable");
 assert.ok(navigation.findPath({x:21,z:4},{x:21,z:0.5}).length,"The cafe can still be entered");
 console.log("Cafe validation passed: hidden interior, opaque front/sides/back/gables/roof, window collision and walkable doorway.");
}catch(error){ console.error(error.message); process.exitCode=1; }finally{THREE.TextureLoader.prototype.load=load;globalThis.document=previousDocument;}
