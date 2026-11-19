import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState,applyUpdates,bingoLines} from '../lib/model.ts';
test('student changes cannot unlock an award or prototype keys',()=>{
 for(const path of ['unlocked','profile.__proto__','reflection.constructor','lessons.8.topic','bingo.9'])assert.throws(()=>applyUpdates(blankState(),[{path,value:'x'}]));
});
test('lesson notes and Unicode profile fields survive updates independently',()=>{
 const original=blankState();const one=applyUpdates(original,[{path:'profile.student',value:'Нюся'},{path:'lessons.0.topic',value:'Циклы for и while'},{path:'lessons.0.date',value:'2026-11-19'}]);
 const two=applyUpdates(one,[{path:'bingo.4',value:true}]);
 assert.equal(two.lessons[0].topic,'Циклы for и while');assert.equal(two.profile.student,'Нюся');assert.equal(two.bingo[4],true);assert.equal(original.profile.student,'');
});
test('bingo counts completed rows and validates input types',()=>{
 const b=Array(9).fill(false);b[0]=b[1]=b[2]=true;assert.equal(bingoLines(b),1);assert.equal(bingoLines(Array(9).fill(true)),8);
 assert.throws(()=>applyUpdates(blankState(),[{path:'bingo.0',value:'true'}]));assert.throws(()=>applyUpdates(blankState(),[{path:'profile.materialsUrl',value:'javascript:alert(1)'}]));
});
