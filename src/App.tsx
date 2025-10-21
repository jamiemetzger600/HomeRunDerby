import React, { useEffect, useMemo, useState } from "react";

export default function HomeRunDerby() {
  type Pitch = '' | 'x' | 'hr';
  type Player = { id: string; name: string; main: Pitch[]; tb: Pitch[][] };

  // Sound effects using Web Audio API
  const playSound = (type: 'hr' | 'miss') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (type === 'hr') {
        // Big crowd cheer - multiple oscillators for rich sound
        const oscillators = [];
        const gainNodes = [];
        
        // Create multiple oscillators for a crowd effect
        for (let i = 0; i < 5; i++) {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Different frequencies for each oscillator (crowd voices)
          const baseFreq = 200 + (i * 50);
          oscillator.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, audioContext.currentTime + 0.8);
          
          // Mix of sine and triangle waves for richness
          oscillator.type = i % 2 === 0 ? 'sine' : 'triangle';
          
          // Volume envelope - starts loud, fades out
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.8);
          
          oscillators.push(oscillator);
          gainNodes.push(gainNode);
        }
      }
      // No sound for misses - silence
    } catch (error) {
      // Silently fail if audio context is not available
    }
  };

  const [players, setPlayers] = useState<Player[]>(() => {
    try { const raw = localStorage.getItem('hrd_players_v2'); return raw? JSON.parse(raw): []; } catch { return []; }
  });
  const [name, setName] = useState('');
  const [locked, setLocked] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem('hrd_locked_v2')||'false'); } catch { return false; } });
  const [ended, setEnded] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem('hrd_ended_v2')||'false'); } catch { return false; } });
  const [history, setHistory] = useState<any[]>([]);
  const [tb, setTb] = useState<{active:boolean; ids:string[]; round:number; idx:number; pitch:number}>({active:false, ids:[], round:0, idx:0, pitch:0});
  const [pitchCount, setPitchCount] = useState<number>(() => { try { return JSON.parse(localStorage.getItem('hrd_pitch_count_v2')||'6'); } catch { return 6; } });

  useEffect(()=>localStorage.setItem('hrd_players_v2', JSON.stringify(players)),[players]);
  useEffect(()=>localStorage.setItem('hrd_locked_v2', JSON.stringify(locked)),[locked]);
  useEffect(()=>localStorage.setItem('hrd_ended_v2', JSON.stringify(ended)),[ended]);
  useEffect(()=>localStorage.setItem('hrd_pitch_count_v2', JSON.stringify(pitchCount)),[pitchCount]);

  const scores = useMemo(()=> new Map(players.map(p=>[p.id, (p.main.filter(m=>m==='hr').length + p.tb.flat().filter(m=>m==='hr').length)])),[players]);
  const maxHr = useMemo(()=> players.length? Math.max(...players.map(p=>scores.get(p.id) || 0)) : 0,[players, scores]);
  const leaders = useMemo(()=> players.filter(p=> (scores.get(p.id)||0)===maxHr && maxHr>0),[players, maxHr, scores]);
  const top3 = useMemo(()=> [...players].sort((a,b)=> (scores.get(b.id)||0) - (scores.get(a.id)||0) || a.name.localeCompare(b.name)).slice(0,3),[players, scores]);

  const blankPitches = () => Array.from({length:pitchCount},()=>'' as Pitch);

  function addPlayer(){
    const n = name.trim(); if(!n) return;
    const p: Player = { id: crypto.randomUUID(), name: n, main: blankPitches(), tb: [] };
    setPlayers(v=>[...v, p]); setHistory(h=>[{op:'add', p}, ...h]); setName('');
  }

  function undo(){ 
    const last=history[0]; 
    if(!last) return; 
    setHistory(h=>h.slice(1)); 
    
    if(last.op==='add'){ 
      setPlayers(v=>v.filter(p=>p.id!==last.p.id)); 
    } else if(last.op==='remove'){ 
      setPlayers(v=>[last.p, ...v]); 
    } else if(last.op==='pitch'){ 
      if(last.scope==='main'){ 
        setPlayers(prev=>prev.map(p=>{ 
          if(p.id!==last.id) return p; 
          const order:Pitch[]=['','x','hr']; 
          const cur=p.main[last.idx]||''; 
          const prevMark=order[(order.indexOf(cur)+order.length-1)%order.length]; 
          const main=[...p.main]; 
          main[last.idx]=prevMark; 
          return {...p, main}; 
        })); 
      } else if(last.scope==='tb'){ 
        setPlayers(prev=>prev.map(p=>{ 
          if(p.id!==last.id) return p; 
          const tb=p.tb.map(r=>[...r]); 
          const cur=tb[last.round]?.[last.pitch]||''; 
          if(tb[last.round]) tb[last.round][last.pitch]=''; 
          return {...p, tb}; 
        })); 
        
        // After undoing a lightning round move, check if we need to reset winner state
        // Use setTimeout to ensure state updates are processed
        setTimeout(() => {
          const currentPlayers = players.map(p => {
            if (p.id === last.id) {
              const tb = p.tb.map(r => [...r]);
              if (tb[last.round]) tb[last.round][last.pitch] = '';
              return { ...p, tb };
            }
            return p;
          });
          
          // Check if any lightning round scores exist
          const hasLightningScores = currentPlayers.some(p => 
            p.tb.some(round => round.some(pitch => pitch !== ''))
          );
          
          // If no lightning scores exist and we're in a winner state, reset to tie-breaker
          if (!hasLightningScores && ended) {
            setEnded(false);
            setTb({active: true, ids: tb.ids, round: 0, idx: 0, pitch: 0});
          }
        }, 0);
      } 
    } 
    
    // After undo, ensure we're not locked out of making changes
    // Only keep locked state if the game has actually ended
    if (!ended) {
      setLocked(false);
    }
  }

  function cycleMain(id:string, idx:number, isDoubleClick:boolean = false){ 
    setPlayers(prev=>prev.map(p=>{ 
      if(p.id!==id) return p; 
      const order:Pitch[]=['','x','hr']; 
      const cur=p.main[idx]||''; 
      const nxt=order[(order.indexOf(cur)+1)%order.length]; 
      const main=[...p.main]; 
      main[idx]=nxt; 
      
      // Play sound effect only on double-click home runs
      if (isDoubleClick && nxt === 'hr') playSound('hr');
      
      return {...p, main}; 
    })); 
    setHistory(h=>[{op:'pitch', scope:'main', id, idx}, ...h]); 
  }

  function endMainRound(){ setLocked(true); const top=maxHr; const tied=players.filter(p=>(scores.get(p.id)||0)===top); if(tied.length>=2){ setEnded(false); setTb({active:true, ids:tied.map(t=>t.id), round:0, idx:0, pitch:0}); } else { setEnded(true); } }

  function recordTb(id:string, round:number, pitch:number, mark:Pitch){ setPlayers(prev=>prev.map(p=>{ if(p.id!==id) return p; const tb = p.tb.map(r=>[...r]); while(tb.length<=round) tb.push([]); const prevMark = tb[round][pitch]||''; tb[round][pitch]=mark; return {...p, tb}; })); setHistory(h=>[{op:'pitch', scope:'tb', id, round, pitch, mark}, ...h]); }

  function recordLightning(pitchIndex:number, isDoubleClick:boolean = false){ 
    if(!tb.active) return; 
    const id=tb.ids[tb.idx]; 
    const currentRoundPitches = players.find(p=>p.id===id)?.tb[tb.round] || [];
    const currentPitch = currentRoundPitches[pitchIndex] || '';
    
    // Cycle through: '' -> 'x' -> 'hr' -> ''
    const order:Pitch[] = ['','x','hr'];
    const currentIndex = order.indexOf(currentPitch);
    const nextIndex = (currentIndex + 1) % order.length;
    const nextMark = order[nextIndex];
    
    // Play sound effect only on double-click home runs
    if (isDoubleClick && nextMark === 'hr') playSound('hr');
    
    recordTb(id, tb.round, pitchIndex, nextMark);
  }

  function endLightningRound(){
    if(!tb.active) return;
    
    const id = tb.ids[tb.idx];
    
    // Move to next player or next round
    let nextIdx = tb.idx + 1;
    let nextRound = tb.round;
    
    if (nextIdx >= tb.ids.length) {
      // All players completed this round, check for winner
      // Calculate total Lightning Round scores for all players
      const lightningScores = new Map();
      
      tb.ids.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        let totalLightningHrs = 0;
        
        // Sum up all home runs from all lightning rounds for this player
        if (player) {
          player.tb.forEach(round => {
            round.forEach(pitch => {
              if (pitch === 'hr') totalLightningHrs++;
            });
          });
        }
        
        lightningScores.set(playerId, totalLightningHrs);
      });
      
      const topVal = Math.max(...lightningScores.values());
      const still = tb.ids.filter(pid => lightningScores.get(pid) === topVal);
      
      if (still.length === 1) {
        // We have a winner!
        setTb({active:false, ids:[], round:0, idx:0, pitch:0});
        setEnded(true);
        return;
      }
      
      // Still tied, start next round
      nextIdx = 0;
      nextRound = tb.round + 1;
    }
    
    setTb({...tb, idx: nextIdx, round: nextRound});
  }

  function reset(){ if(!confirm('Reset all scores and players?')) return; setPlayers([]); setLocked(false); setEnded(false); setHistory([]); setTb({active:false, ids:[], round:0, idx:0, pitch:0}); }

  function share(){ const data={players, locked, ended, tb}; const encoded=btoa(JSON.stringify(data)); navigator.clipboard.writeText(`${location.origin}${location.pathname}#hrd=${encoded}`); }

  useEffect(()=>{ const key="#hrd="; if(location.hash.startsWith(key)){ try{ const d=JSON.parse(atob(location.hash.slice(key.length))); if(d.players) setPlayers(d.players); if(typeof d.locked==='boolean') setLocked(d.locked); if(typeof d.ended==='boolean') setEnded(d.ended); if(d.tb) setTb(d.tb); } catch {} } },[]);

  function short(n:string){ const parts=n.trim().split(/\s+/); if(parts.length===1) return parts[0]; const last=parts[parts.length-1]; return `${parts[0]} ${last.charAt(0).toUpperCase()}.`; }


  return (
    <div style={{minHeight: '100vh', backgroundColor: '#1a1a1a', color: '#fff', padding: '10px', fontFamily: 'Arial, sans-serif'}}>
      <div style={{maxWidth: '800px', margin: '0 auto', padding: '10px'}}>
        <header style={{marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'}}>
          <h1 style={{fontSize: '1.8rem', margin: 0, textAlign: 'center'}}>Home Run Derby</h1>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center'}}>
            <button onClick={undo} disabled={!history.length} style={{padding: '8px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: history.length ? 'pointer' : 'not-allowed', fontSize: '0.9rem'}}>Undo</button>
            <button onClick={share} style={{padding: '8px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem'}}>Share</button>
            <button onClick={reset} style={{padding: '8px 12px', backgroundColor: '#dc2626', color: '#fff', border: '1px solid #dc2626', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem'}}>Reset</button>
          </div>
        </header>

        <div style={{backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '20px', marginBottom: '20px'}}>
          <h2 style={{marginTop: 0, marginBottom: '15px'}}>Game Settings</h2>
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', alignItems: 'center'}}>
            <label style={{color: '#fff', fontSize: '0.9rem'}}>Pitches per player:</label>
            <select
              value={pitchCount}
              onChange={e=>setPitchCount(parseInt(e.target.value))}
              disabled={locked}
              style={{padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px'}}
            >
              {[3,4,5,6,7,8,9,10].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <h3 style={{marginTop: 0, marginBottom: '15px'}}>Add Players</h3>
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
              <div style={{color: '#f59e0b', fontWeight: 'bold'}}>⚡ Lightning round {tb.round + 1} (3 pitches each)</div>
            ) : (
              <div style={{color: '#999', fontSize: '0.9rem'}}>Mark each of {pitchCount} pitches: click to cycle ☐ → ✗ → HR</div>
            )}
          </div>
          
          {players.length === 0 ? (
            <p style={{color: '#999'}}>No players yet.</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              {(() => {
                // Sort players to put active lightning round player first
                const sortedPlayers = [...players];
                if (tb.active && tb.ids[tb.idx]) {
                  const activePlayerId = tb.ids[tb.idx];
                  const activePlayerIndex = sortedPlayers.findIndex(p => p.id === activePlayerId);
                  if (activePlayerIndex !== -1) {
                    const [activePlayer] = sortedPlayers.splice(activePlayerIndex, 1);
                    sortedPlayers.unshift(activePlayer);
                  }
                }
                
                return sortedPlayers.map((p, idx)=> {
                  const isActiveLightningPlayer = tb.active && p.id === tb.ids[tb.idx];
                  const displayRank = players.findIndex(player => player.id === p.id) + 1;
                  
                  return (
                    <div key={p.id} style={{
                      backgroundColor: isActiveLightningPlayer ? '#451a03' : '#333', 
                      border: ended && (scores.get(p.id)||0)===maxHr ? '2px solid #f59e0b' : isActiveLightningPlayer ? '2px solid #fcd34d' : '1px solid #555', 
                      borderRadius: '8px', 
                      padding: '15px'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          {(ended && (scores.get(p.id)||0)===maxHr) && <span>🏆</span>}
                          {isActiveLightningPlayer && <span>⚡</span>}
                          <span style={{fontWeight: 'bold'}}>{displayRank}. {p.name}</span>
                          {isActiveLightningPlayer && <span style={{color: '#fcd34d', fontSize: '0.8rem'}}>(Lightning Round)</span>}
                        </div>
                        <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{scores.get(p.id)||0}</div>
                      </div>

                      {/* Show lightning round pitches if this is the active player */}
                      {isActiveLightningPlayer ? (
                        <div>
                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: '10px'}}>
                            {Array.from({length: 3}).map((_, i)=> {
                              const currentRoundPitches = p.tb[tb.round] || [];
                              const pitch = currentRoundPitches[i] || '';
                              return (
                              <button 
                                key={i} 
                                onClick={()=>recordLightning(i)} 
                                onDoubleClick={()=>recordLightning(i, true)} 
                                title={`Lightning Pitch ${i+1} - Double-click for home run sound`}
                                style={{
                                  aspectRatio: '1',
                                  minHeight: '60px',
                                  border: '1px solid #555',
                                  borderRadius: '6px',
                                  backgroundColor: pitch==='hr' ? '#047857' : pitch==='x' ? '#be123c' : '#444',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  touchAction: 'manipulation'
                                }}
                              >
                                  {pitch==='' ? '☐' : pitch==='x' ? '✗' : 'HR'}
                                </button>
                              );
                            })}
                          </div>
                          <button 
                            onClick={endLightningRound}
                            style={{
                              padding: '12px 20px',
                              backgroundColor: '#f59e0b',
                              color: '#fff',
                              border: '1px solid #f59e0b',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              minHeight: '48px',
                              touchAction: 'manipulation'
                            }}
                          >
                            End Round
                          </button>
                        </div>
                      ) : (
                        // Regular main round display
                        <div style={{display: 'grid', gridTemplateColumns: `repeat(${pitchCount}, 1fr)`, gap: '5px'}}>
                          {p.main.map((m, i)=> (
                            <button 
                              key={i} 
                              onClick={()=>!locked && !tb.active && !ended && cycleMain(p.id,i)} 
                              onDoubleClick={()=>!locked && !tb.active && !ended && cycleMain(p.id,i, true)} 
                              title={`Pitch ${i+1} - Double-click for home run sound`}
                              style={{
                                aspectRatio: '1',
                                minHeight: '50px',
                                border: '1px solid #555',
                                borderRadius: '6px',
                                backgroundColor: m==='hr' ? '#047857' : m==='x' ? '#be123c' : '#444',
                                color: '#fff',
                                cursor: (locked||tb.active||ended) ? 'not-allowed' : 'pointer',
                                opacity: (locked||tb.active||ended) ? 0.6 : 1,
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                touchAction: 'manipulation'
                              }}
                            >
                              {m==='' ? '☐' : m==='x' ? '✗' : 'HR'}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Show previous lightning rounds */}
                      {p.tb.length>0 && !isActiveLightningPlayer && (
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
                  );
                });
              })()}
            </div>
          )}
        </div>

        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px'}}>
          {!ended && !tb.active && (
            <button onClick={endMainRound} disabled={!players.length} style={{padding: '10px 20px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: !players.length ? 'not-allowed' : 'pointer'}}>End Main Round</button>
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