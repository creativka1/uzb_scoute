import {NextRequest,NextResponse} from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const q=request.nextUrl.searchParams,league=q.get('league')||'UZB',year=q.get('year')||'2026',playerId=q.get('playerId');
 if(!['UZB','KAZ'].includes(league)||!/^20\d{2}$/.test(year)||(playerId!==null&&!/^\d+$/.test(playerId)))return NextResponse.json({error:'INVALID_FILTER'},{status:400});
 const read=(file:string)=>{try{return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data',file),'utf8'));}catch{return null;}};
 const status=read('audits/footystats_status.json')||{state:'not_synced',leagues:{}};
 const snapshot=read(`footystats/${league}-${year}.json`);
 const current=status.year===Number(year)&&status.leagues?.[league]?.state==='connected';
 const players=snapshot?.schemaVersion===1&&snapshot.league===league&&snapshot.year===Number(year)?snapshot.players:[];
 return NextResponse.json({provider:'FootyStats',state:current?'connected':status.year!==Number(year)?'not_synced':status.leagues?.[league]?.state||status.state,checkedAt:status.checkedAt||null,fetchedAt:snapshot?.fetchedAt||null,year:Number(year),seasonId:snapshot?.seasonId||null,players:players.length,linked:players.filter((p:any)=>p.sofaId!==null).length,stale:!!snapshot&&!current,player:playerId?players.find((p:any)=>p.sofaId===Number(playerId))||null:null},{headers:{'Cache-Control':'no-store'}});
}
