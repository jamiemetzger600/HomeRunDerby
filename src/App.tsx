import React, { useEffect, useMemo, useState } from "react";

export default function HomeRunDerby() {
  type Pitch = '' | 'x' | 'hr';
  type Player = { id: string; name: string; main: Pitch[]; tb: Pitch[][] };

  const [players, setPlayers] = useState<Player[]>(() => {
    try { const raw = localStorage.getItem('hrd_players_v2'); return raw? JSON.parse(raw): []; } catch { return []; }
  });
  const [name, setName] = useState('');
  const [locked, setLocked] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem('hrd_locked_v2')||'false'); } catch { return false; } });
  const [ended, setEnded] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem('hrd_ended_v2')||'false'); } catch { return false; } });
  const [history, setHistory] = useState<any[]>([]);
  const [tb, setTb] = useState<{active:boolean; ids:string[]; round:number; idx:number; pitch:number}>({active:false, ids:[], round:0, idx:0, pitch:0});

  useEffect(()=>localStorage.setItem('hrd_players_v2', JSON.stringify(players)),[players]);
  useEffect(()=>localStorage.setItem('hrd_locked_v2', JSON.stringify(locked)),[locked]);
  useEffect(()=>localStorage.setItem('hrd_ended_v2', JSON.stringify(ended)),[ended]);

  const scores = useMemo(()=> new Map(players.map(p=>[p.id, (p.main.filter(m=>m==='hr').length + p.tb.flat().filter(m=>m==='hr').length)])),[players]);
  const maxHr = useMemo(()=> players.length? Math.max(...players.map(p=>scores.get(p.id) || 0)) : 0,[players, scores]);
  const leaders = useMemo(()=> players.filter(p=> (scores.get(p.id)||0)===maxHr && maxHr>0),[players, maxHr, scores]);
  const top3 = useMemo(()=> [...players].sort((a,b)=> (scores.get(b.id)||0) - (scores.get(a.id)||0) || a.name.localeCompare(b.name)).slice(0,3),[players, scores]);

  const blank7 = () => Array.from({length:7},()=>'' as Pitch);

  function addPlayer(){
    const n = name.trim(); if(!n) return;
    const p: Player = { id: crypto.randomUUID(), name: n, main: blank7(), tb: [] };
    setPlayers(v=>[...v, p]); setHistory(h=>[{op:'add', p}, ...h]); setName('');
  }

  function undo(){ const last=history[0]; if(!last) return; setHistory(h=>h.slice(1)); if(last.op==='add'){ setPlayers(v=>v.filter(p=>p.id!==last.p.id)); } else if(last.op==='remove'){ setPlayers(v=>[last.p, ...v]); } else if(last.op==='pitch'){ if(last.scope==='main'){ setPlayers(prev=>prev.map(p=>{ if(p.id!==last.id) return p; const order:Pitch[]=['','x','hr']; const cur=p.main[last.idx]||''; const prevMark=order[(order.indexOf(cur)+order.length-1)%order.length]; const main=[...p.main]; main[last.idx]=prevMark; return {...p, main}; })); } else if(last.scope==='tb'){ setPlayers(prev=>prev.map(p=>{ if(p.id!==last.id) return p; const tb=p.tb.map(r=>[...r]); const cur=tb[last.round]?.[last.pitch]||''; if(tb[last.round]) tb[last.round][last.pitch]=''; return {...p, tb}; })); } } }

  function cycleMain(id:string, idx:number){ setPlayers(prev=>prev.map(p=>{ if(p.id!==id) return p; const order:Pitch[]=['','x','hr']; const cur=p.main[idx]||''; const nxt=order[(order.indexOf(cur)+1)%order.length]; const main=[...p.main]; main[idx]=nxt; return {...p, main}; })); setHistory(h=>[{op:'pitch', scope:'main', id, idx}, ...h]); }

  function endMainRound(){ setLocked(true); const top=maxHr; const tied=players.filter(p=>(scores.get(p.id)||0)===top); if(tied.length>=2){ setEnded(false); setTb({active:true, ids:tied.map(t=>t.id), round:0, idx:0, pitch:0}); } else { setEnded(true); } }

  function recordTb(id:string, round:number, pitch:number, mark:Pitch){ setPlayers(prev=>prev.map(p=>{ if(p.id!==id) return p; const tb = p.tb.map(r=>[...r]); while(tb.length<=round) tb.push([]); const prevMark = tb[round][pitch]||''; tb[round][pitch]=mark; return {...p, tb}; })); setHistory(h=>[{op:'pitch', scope:'tb', id, round, pitch, mark}, ...h]); }

  function recordLightning(mark:Pitch){ if(!tb.active) return; const id=tb.ids[tb.idx]; recordTb(id, tb.round, tb.pitch, mark); const proj=new Map(scores); if(mark==='hr') proj.set(id, (proj.get(id)||0)+1);
    let nextPitch=tb.pitch+1; let nextIdx=tb.idx; let nextRound=tb.round;
    if(nextPitch>=3){ nextPitch=0; nextIdx+=1; }
    if(nextIdx>=tb.ids.length){ const topVal=Math.max(...tb.ids.map(pid=>proj.get(pid)||0)); const still=tb.ids.filter(pid=>(proj.get(pid)||0)===topVal); if(still.length===1){ setTb({active:false, ids:[], round:0, idx:0, pitch:0}); setEnded(true); return; } nextIdx=0; nextRound=tb.round+1; }
    setTb({...tb, pitch:nextPitch, idx:nextIdx, round:nextRound});
  }

  function reset(){ if(!confirm('Reset all scores and players?')) return; setPlayers([]); setLocked(false); setEnded(false); setHistory([]); setTb({active:false, ids:[], round:0, idx:0, pitch:0}); }

  function share(){ const data={players, locked, ended, tb}; const encoded=btoa(JSON.stringify(data)); navigator.clipboard.writeText(`${location.origin}${location.pathname}#hrd=${encoded}`); }

  useEffect(()=>{ const key="#hrd="; if(location.hash.startsWith(key)){ try{ const d=JSON.parse(atob(location.hash.slice(key.length))); if(d.players) setPlayers(d.players); if(typeof d.locked==='boolean') setLocked(d.locked); if(typeof d.ended==='boolean') setEnded(d.ended); if(d.tb) setTb(d.tb); } catch {} } },[]);

  function short(n:string){ const parts=n.trim().split(/\s+/); if(parts.length===1) return parts[0]; const last=parts[parts.length-1]; return `${parts[0]} ${last.charAt(0).toUpperCase()}.`; }


  return (
    <div style={{minHeight: '100vh', backgroundColor: '#1a1a1a', color: '#fff', padding: '20px', fontFamily: 'Arial, sans-serif'}}>
      <div style={{maxWidth: '800px', margin: '0 auto'}}>
        <header style={{marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h1 style={{fontSize: '2rem', margin: 0}}>Home Run Derby</h1>
          <div style={{display: 'flex', gap: '10px'}}>
            <button onClick={undo} disabled={!history.length} style={{padding: '8px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: history.length ? 'pointer' : 'not-allowed'}}>Undo</button>
            <button onClick={share} style={{padding: '8px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer'}}>Share</button>
            <button onClick={reset} style={{padding: '8px 12px', backgroundColor: '#dc2626', color: '#fff', border: '1px solid #dc2626', borderRadius: '4px', cursor: 'pointer'}}>Reset</button>
          </div>
        </header>

        <div style={{backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '20px', marginBottom: '20px'}}>
          <h2 style={{marginTop: 0, marginBottom: '15px'}}>Add Players</h2>
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
            <input
              placeholder="Player name"
              value={name}
              onChange={e=>setName(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') addPlayer(); }}
              disabled={locked}
              style={{flex: 1, minWidth: '200px', padding: '10px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px'}}
            />
            <button onClick={addPlayer} disabled={locked || !name.trim()} style={{padding: '10px 20px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: (locked || !name.trim()) ? 'not-allowed' : 'pointer'}}>Add</button>
            <button onClick={()=>setLocked(v=>!v)} style={{padding: '10px 20px', backgroundColor: locked ? '#059669' : '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer'}}>{locked ? 'Unlock' : 'Lock Roster'}</button>
          </div>
        </div>

        <div style={{backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '20px', marginBottom: '20px'}}>
          <h2 style={{marginTop: 0, marginBottom: '15px'}}>Current Top 3</h2>
          {players.length === 0 ? (
            <p style={{color: '#999'}}>No players yet.</p>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
              {top3.map((p,i)=> (
                <div key={p.id} style={{backgroundColor: '#333', border: '1px solid #555', borderRadius: '8px', padding: '15px', textAlign: 'center'}}>
                  <div style={{fontSize: '0.8rem', color: '#999', textTransform: 'uppercase'}}>{i===0?'1st':i===1?'2nd':'3rd'}</div>
                  <div style={{fontWeight: 'bold', margin: '5px 0'}}>{short(p.name)}</div>
                  <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{scores.get(p.id)||0}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '20px', marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h2 style={{margin: 0}}>Leaderboard</h2>
            {ended ? (
              <div style={{color: '#10b981', fontWeight: 'bold'}}>🏆 Winner{leaders.length>1?'s':''} crowned</div>
            ) : tb.active ? (
              <div style={{color: '#f59e0b', fontWeight: 'bold'}}>⚡ Lightning round (3 pitches each)</div>
            ) : (
              <div style={{color: '#999', fontSize: '0.9rem'}}>Mark each of 7 pitches: click to cycle ☐ → ✗ → HR</div>
            )}
          </div>
          
          {players.length === 0 ? (
            <p style={{color: '#999'}}>No players yet.</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              {players.map((p, idx)=> (
                <div key={p.id} style={{
                  backgroundColor: '#333', 
                  border: ended && (scores.get(p.id)||0)===maxHr ? '2px solid #f59e0b' : '1px solid #555', 
                  borderRadius: '8px', 
                  padding: '15px'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      {(ended && (scores.get(p.id)||0)===maxHr) && <span>🏆</span>}
                      <span style={{fontWeight: 'bold'}}>{idx+1}. {p.name}</span>
                    </div>
                    <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{scores.get(p.id)||0}</div>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px'}}>
                    {p.main.map((m, i)=> (
                      <button 
                        key={i} 
                        onClick={()=>!locked && !tb.active && !ended && cycleMain(p.id,i)} 
                        title={`Pitch ${i+1}`}
                        style={{
                          aspectRatio: '1',
                          border: '1px solid #555',
                          borderRadius: '6px',
                          backgroundColor: m==='hr' ? '#047857' : m==='x' ? '#be123c' : '#444',
                          color: '#fff',
                          cursor: (locked||tb.active||ended) ? 'not-allowed' : 'pointer',
                          opacity: (locked||tb.active||ended) ? 0.6 : 1,
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {m==='' ? '☐' : m==='x' ? '✗' : 'HR'}
                      </button>
                    ))}
                  </div>

                  {p.tb.length>0 && (
                    <div style={{marginTop: '10px', fontSize: '0.8rem', color: '#999'}}>
                      {p.tb.map((r, ri)=> (
                        <div key={ri} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                          <span style={{backgroundColor: '#451a03', color: '#fcd34d', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem'}}>TB {ri+1}</span>
                          <div style={{display: 'flex', gap: '4px'}}>
                            {Array.from({length:3}).map((_,ti)=>{
                              const m=r[ti]||''; 
                              return (
                                <span 
                                  key={ti} 
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    border: '1px solid #555',
                                    backgroundColor: m==='hr' ? '#047857' : m==='x' ? '#be123c' : '#444',
                                    color: '#fff',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {m==='hr' ? 'HR' : m==='x' ? '✗' : '☐'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px'}}>
          {!ended && !tb.active && (
            <button onClick={endMainRound} disabled={!players.length} style={{padding: '10px 20px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: !players.length ? 'not-allowed' : 'pointer'}}>End Main Round</button>
          )}
          {tb.active && (
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#451a03', border: '1px solid #b45309', borderRadius: '8px', padding: '15px'}}>
              <span style={{fontWeight: 'bold', color: '#fcd34d'}}>Lightning • Round {tb.round+1} • Pitch {tb.pitch+1}/3</span>
              <span>—</span>
              <span>{players.find(p=>p.id===tb.ids[tb.idx])?.name}</span>
              <button onClick={()=>recordLightning('x')} style={{padding: '8px 12px', backgroundColor: '#be123c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>✗</button>
              <button onClick={()=>recordLightning('hr')} style={{padding: '8px 12px', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>HR</button>
            </div>
          )}
        </div>

        {ended && (
          <div style={{backgroundColor: '#451a03', border: '1px solid #b45309', borderRadius: '8px', padding: '20px'}}>
            <h2 style={{marginTop: 0, marginBottom: '5px'}}>Winner{leaders.length>1?'s':''}</h2>
            <p style={{margin: 0}}>{leaders.map(l=>l.name).join(', ')} with {maxHr} HR{maxHr===1?'':'s'}.</p>
          </div>
        )}

        <footer style={{textAlign: 'center', marginTop: '30px', color: '#999', fontSize: '0.8rem'}}>Made for quick backyard bragging rights ⚾️</footer>
      </div>
    </div>
  );
}