const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
// Small hook driver exercises the real components and persistence handlers without a browser.
function environment(){
  let active;const storage=new Map(),events=new EventTarget(),cache=new Map();
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  const react={...require('react'),useState(initial){const owner=active,index=owner.cursor++;if(!(index in owner.values))owner.values[index]=typeof initial==='function'?initial():initial;return [owner.values[index],next=>{owner.values[index]=typeof next==='function'?next(owner.values[index]):next;}];},useEffect(effect,deps){const owner=active,index=owner.cursor++,prior=owner.values[index];if(!prior||deps.some((x,i)=>x!==prior.deps[i])){owner.effects.push(()=>{prior?.cleanup?.();owner.values[index]={deps,cleanup:effect()};});}}};
  function load(file){if(cache.has(file))return cache.get(file);const exports={};const imports=name=>{if(name==='react')return react;if(!name.startsWith('@/')&&!name.startsWith('.'))return require(name);const base=name.startsWith('@/')?name.slice(2):path.join(path.dirname(file),name);return load(base+(fs.existsSync(path.join(root,base+'.tsx'))?'.tsx':'.ts'));};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:imports,localStorage,window:events,Event,crypto:require('node:crypto').webcrypto,Date,Number,Set,Map,Object,JSON,console});cache.set(file,exports);return exports;}
  function runner(Component,props){const owner={cursor:0,values:[],effects:[],render(){owner.cursor=0;active=owner;const tree=Component(props);active=null;const effects=owner.effects.splice(0);effects.forEach(f=>f());owner.tree=tree;return tree;},dispose(){owner.values.forEach(v=>v?.cleanup?.());}};owner.render();owner.render();return owner;}
  return {load,runner,storage};
}
function nodes(node){if(node===null||node===undefined||typeof node==='boolean')return [];if(Array.isArray(node))return node.flatMap(nodes);if(typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
function text(node){if(node===null||node===undefined||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(text).join('');if(typeof node!=='object')return String(node);return text(node.props?.children);}
function field(r,label,type){const l=nodes(r.tree).find(n=>n.type==='label'&&text(n).startsWith(label));assert.ok(l,label);return nodes(l).find(n=>n.type===type);}
function change(r,label,type,value){field(r,label,type).props.onChange({target:{value}});r.render();}
const matches=[1,2,3,4,5].map(id=>({id,date:id*100,league:'UZB',seasonId:10,homeTeamId:1,awayTeamId:2,homeScore:1,awayScore:0,eventHash:'e'+id,lineupHash:'l'+id}));
const core={matches,appearances:matches.map(m=>({matchId:m.id,playerId:7,teamId:2,position:'MF',minutes:90,stats:{keyPasses:2}})),teams:[{id:1,name:'Club'},{id:2,name:'Other'}],players:[{id:7,name:'Candidate'}],seasons:{UZB:[{id:10,name:'Season'}],KAZ:[]}};
test('real UI handlers persist need → linked candidate → frozen decision → review after new appearances',()=>{
  const env=environment(),ui=env.load('components/football/decision-workspace.tsx'),lib=env.load('lib/decisions.ts');let chosen;
  const form=env.runner(ui.NeedForm,{core,teamId:1,seasonId:10,seed:{position:'MF',detailedPosition:null,evidence:'Source minutes'},lang:'ru',onDone:n=>{chosen=n;}});
  change(form,'Что требуется','textarea','Improve chance creation');change(form,'Что должен','textarea','More key passes');form.tree.props.onSubmit({preventDefault(){}});assert.ok(chosen);
  const candidate=env.runner(ui.CandidateLinkButton,{needId:chosen.id,player:{id:'UZB-7',league:'UZB',statsSeasonIds:[10],position:'MF',name:{ru:'Candidate',uz:'Candidate'},roleMetrics:{keyPassesPer90:2}},lang:'ru',fitScore:87,fitReasons:['role:82','minutes:900']});
  nodes(candidate.tree).find(n=>n.type==='button').props.onClick();candidate.render();assert.ok(text(candidate.tree).includes('✓'));
  const workspace=env.runner(ui.DecisionWorkspace,{core,teamId:1,seasonId:10,lang:'ru'});
  const statusLabel=nodes(workspace.tree).find(n=>n.type==='label'&&text(n).startsWith('Статус'));assert.ok(statusLabel);
  nodes(statusLabel).find(n=>n.type==='select').props.onChange({target:{value:'priority'}});workspace.render();
  const noteLabel=nodes(workspace.tree).find(n=>n.type==='label'&&text(n).startsWith('Заметка скаута'));assert.ok(noteLabel);
  nodes(noteLabel).find(n=>n.type==='textarea').props.onBlur({currentTarget:{value:'Check scanning before receiving under pressure'}});workspace.render();
  nodes(workspace.tree).find(n=>n.type==='button'&&text(n)==='Сделать рекомендацией').props.onClick();workspace.render();
  let boardStore=lib.parseDecisionStore(env.storage.get(lib.decisionStorageKey));assert.equal(boardStore.needs[0].candidates[0].boardStatus,'priority');assert.equal(boardStore.needs[0].candidates[0].scoutNote,'Check scanning before receiving under pressure');assert.equal(boardStore.needs[0].recommendedPlayerId,7);assert.equal(boardStore.needs[0].candidates[0].fitScore,87);
  nodes(workspace.tree).find(n=>n.type==='button'&&text(n)==='Зафиксировать решение').props.onClick();workspace.render();
  const formElement=nodes(workspace.tree).find(n=>typeof n.type==='function'&&n.type.name==='DecisionForm');assert.ok(formElement);
  const decisionForm=env.runner(formElement.type,formElement.props);change(decisionForm,'Решение:','textarea','Monitor candidate before transfer');change(decisionForm,'Начало наблюдения','select','200');change(decisionForm,'Проверить после','select','3');
  nodes(decisionForm.tree).find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'1'}});decisionForm.render();decisionForm.tree.props.onSubmit({preventDefault(){}});
  const stored=lib.parseDecisionStore(env.storage.get(lib.decisionStorageKey));assert.equal(stored.decisions.length,1);assert.equal(stored.decisions[0].needId,chosen.id);assert.equal(stored.decisions[0].target.playerId,7);assert.equal(stored.decisions[0].baseline.value,2);
  workspace.render();const cardElement=nodes(workspace.tree).find(n=>typeof n.type==='function'&&n.type.name==='DecisionCard');assert.ok(cardElement);
  const card=env.runner(cardElement.type,cardElement.props);assert.ok(text(card.tree).includes('Критерий достигнут'));change(card,'Комментарий аналитика','textarea','Keep observing; does not prove causal effect');nodes(card.tree).find(n=>n.type==='button'&&text(n)==='Сохранить проверку').props.onClick();
  const restored=lib.parseDecisionStore(env.storage.get(lib.decisionStorageKey));assert.equal(restored.decisions[0].review.result,'met');assert.equal(JSON.stringify(restored.decisions[0].review.snapshot.matchIds),'[3,4,5]');assert.equal(restored.needs[0].candidates.length,1);
  [form,candidate,workspace,decisionForm,card].forEach(r=>r.dispose());
});
test('corrupt local decisions block saves and preserve the original bytes',()=>{
 const env=environment(),lib=env.load('lib/decisions.ts');env.storage.set(lib.decisionStorageKey,'{broken');const ui=env.load('components/football/decision-workspace.tsx');let called=false;
 const form=env.runner(ui.NeedForm,{core,teamId:1,seasonId:10,seed:{position:'MF',detailedPosition:null,evidence:'Source'},lang:'ru',onDone:()=>{called=true;}});change(form,'Что требуется','textarea','Need');change(form,'Что должен','textarea','Requirement');assert.ok(nodes(form.tree).find(n=>n.type==='button').props.disabled);form.tree.props.onSubmit({preventDefault(){}});assert.equal(env.storage.get(lib.decisionStorageKey),'{broken');assert.equal(called,false);form.dispose();
});
