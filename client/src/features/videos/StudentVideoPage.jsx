import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { studentApi } from '../../lib/api';

export default function StudentVideoPage(){
 const {videoId}=useParams(); const location=useLocation(); const navigate=useNavigate();
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [time,setTime]=useState(0),[duration,setDuration]=useState(0),[maxWatched,setMaxWatched]=useState(0),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(false);
 const [speed,setSpeed]=useState(1),[question,setQuestion]=useState(null),[selected,setSelected]=useState(''),[explanation,setExplanation]=useState(''),[saving,setSaving]=useState(false),[courseVideos,setCourseVideos]=useState([]);
 const playerRef=useRef(null), fullscreenRef=useRef(null), tickRef=useRef(null), maxRef=useRef(0), seekingRef=useRef(false), answeredRef=useRef(new Set()), questionRef=useRef(null), durationRef=useRef(0);
 const courseId=location.state?.courseId;
 useEffect(()=>{let live=true; setLoading(true);studentApi.getVideo(videoId).then(d=>{if(!live)return;setData(d); const p=d.progress; const m=Number(p?.max_watched_seconds||0);maxRef.current=m;setMaxWatched(m);answeredRef.current=new Set((d.attempts||[]).map(a=>Number(a.question_id))); setSpeed(Number(d.video.playback_speed||1)); questionRef.current=null;}).catch(e=>setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false}},[videoId]);

 useEffect(()=>{ if(!courseId) return; studentApi.getCourseVideos(courseId).then(r=>setCourseVideos(r.videos||[])).catch(()=>{}); },[courseId]);

 const saveProgress=useCallback(async(force=false)=>{
   if(!data||!playerRef.current)return;
   const totalQ=data.questions.length; const solved=answeredRef.current.size; const correct=(data.attempts||[]).filter(a=>a.is_correct).length;
   const done=duration>0 && maxRef.current>=Math.max(0,duration-2) && solved>=totalQ;
   if(!force && maxRef.current<=Number(data.progress?.max_watched_seconds||0)+1 && !done)return;
   try{await studentApi.saveVideoProgress(videoId,{max_watched_seconds:Math.floor(maxRef.current),questions_solved:solved,total_questions:totalQ,correct_answers:correct,completed:done});}catch(e){console.error(e)}
 },[data,duration,videoId]);
 useEffect(()=>{ questionRef.current=question; },[question]);
 useEffect(()=>{ durationRef.current=duration; },[duration]);
 const saveProgressRef=useRef(saveProgress); useEffect(()=>{saveProgressRef.current=saveProgress},[saveProgress]);
 useEffect(()=>()=>{clearInterval(tickRef.current);saveProgressRef.current(true)},[]);

 useEffect(()=>{
   if(!data)return;
   const id='yt-iframe-api';
   const load=()=>{if(window.YT?.Player) create();};
   function create(){
     if(playerRef.current) try{playerRef.current.destroy()}catch{}
     const vid=extract(data.video.youtube_url); if(!vid){setError('Invalid YouTube URL.');return;}
     playerRef.current=new window.YT.Player('student-youtube-player',{videoId:vid,width:'100%',height:'100%',playerVars:{rel:0,modestbranding:1,controls:0,disablekb:1,playsinline:1},events:{
       onReady:e=>{setDuration(e.target.getDuration()); if(Number(data.progress?.max_watched_seconds||0)>0)e.target.seekTo(Number(data.progress.max_watched_seconds),true); try{e.target.setPlaybackRate(Number(data.video.playback_speed||1));}catch{}},
       onStateChange:e=>{setPlaying(e.data===window.YT.PlayerState.PLAYING); if(e.data===window.YT.PlayerState.PLAYING&&!tickRef.current)startTick(); if(e.data===window.YT.PlayerState.ENDED){setPlaying(false);maxRef.current=Math.max(maxRef.current,durationRef.current);setMaxWatched(maxRef.current);saveProgressRef.current(true)}},
       onPlaybackRateChange:e=>setSpeed(e.data)
     }});
   }
   if(window.YT?.Player) create(); else {window.onYouTubeIframeAPIReady=load;if(!document.getElementById(id)){const s=document.createElement('script');s.id=id;s.src='https://www.youtube.com/iframe_api';document.body.appendChild(s)}}
   function startTick(){clearInterval(tickRef.current);tickRef.current=setInterval(()=>{const p=playerRef.current;if(!p?.getCurrentTime)return;let t=Number(p.getCurrentTime()||0);setTime(t);
      if(!seekingRef.current && data.video.block_forward_seek && t>maxRef.current+2){seekingRef.current=true;p.seekTo(maxRef.current,true);setTimeout(()=>seekingRef.current=false,250);t=maxRef.current}
      if(!seekingRef.current && t>maxRef.current){maxRef.current=t;setMaxWatched(t)}
      const skip=(data.skips||[]).find(x=>t>=Number(x.start_time_seconds)&&t<Number(x.end_time_seconds));
      if(skip&&!seekingRef.current){seekingRef.current=true;p.seekTo(Number(skip.end_time_seconds),true);setTimeout(()=>seekingRef.current=false,250);return}
      if(!questionRef.current && data.video.pause_at_questions){const q=(data.questions||[]).find(q=>!answeredRef.current.has(Number(q.question_id))&&t>=Number(q.timestamp_seconds)&&t<Number(q.timestamp_seconds)+1.5);if(q){p.pauseVideo();questionRef.current=q;setQuestion(q);setSelected('');setExplanation('')}}
   },300)}
   return()=>{clearInterval(tickRef.current);try{playerRef.current?.destroy()}catch{}playerRef.current=null};
 },[data,videoId]); // initialize once per selected video

 const submit=async()=>{if(!question||!selected||saving)return; const option=(question.question_options||[]).find(o=>String(o.option_id)===String(selected)); if(!option)return;setSaving(true);try{await studentApi.submitQuestion(videoId,{question_id:question.question_id,selected_option_id:option.option_id,is_correct:!!option.is_correct});answeredRef.current.add(Number(question.question_id));setData(prev=>({...prev,attempts:[...(prev.attempts||[]).filter(a=>Number(a.question_id)!==Number(question.question_id)),{question_id:question.question_id,is_correct:!!option.is_correct}]}));setExplanation(option.is_correct?(question.explanation||'Correct answer.'):(question.explanation||'Incorrect answer.'));setTimeout(()=>{questionRef.current=null;setQuestion(null);setExplanation('');playerRef.current?.playVideo?.();saveProgressRef.current(true)},1100)}catch(e){setExplanation(e.message)}finally{setSaving(false)}};
 const rewatch=()=>{const t=Math.max(0,time-15);seekingRef.current=true;playerRef.current?.seekTo(t,true);playerRef.current?.playVideo();questionRef.current=null;setQuestion(null);setExplanation('');setTimeout(()=>seekingRef.current=false,400)};
 const togglePlay=()=>{const p=playerRef.current;if(!p)return;playing?p.pauseVideo():p.playVideo()};
 const seek=e=>{const requested=Number(e.target.value); if(data?.video?.block_forward_seek && requested>maxRef.current){e.target.value=String(Math.floor(maxRef.current));return} seekingRef.current=true;playerRef.current?.seekTo(requested,true);setTimeout(()=>seekingRef.current=false,250)};
 const back=()=>navigate(courseId?`/student/courses/${courseId}`:'/student/courses');
 if(loading)return <div className="py-20 text-center text-sm text-slate-500">Loading video...</div>;
 if(error||!data)return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error||'Video unavailable.'}</div>;
 const {video,questions,attempts}=data; const solved=answeredRef.current.size,correct=attempts.filter(a=>a.is_correct).length; const currentIndex=courseVideos.findIndex(v=>String(v.video_id)===String(videoId)); const nextVideo=courseVideos[currentIndex+1];
 return <section className="student-content student-player-page">
   <div className="student-player-topbar">
     <div>
       <button onClick={back} className="student-back-btn"><ArrowLeft size={15}/> Back to Course</button>
       <div className="student-player-title"><h2>{video.video_title}</h2><p>{video.description || 'Video lesson'}</p></div>
     </div>
     {nextVideo && <button type="button" className="student-next-btn" onClick={()=>navigate(`/student/video/${nextVideo.video_id}`,{state:{courseId}})}>Next Video <ArrowLeft size={15} className="student-next-icon"/></button>}
   </div>
   <div ref={fullscreenRef} className={`student-player-layout ${question ? 'has-question' : ''}`}>
     <div>
       <div className={`student-video-player-wrap ${question ? 'question-active' : ''}`}>
         <div id="student-youtube-player" className="student-youtube-frame" />
         <div className="student-video-interaction-shield" aria-hidden="true" />
         <div className="student-custom-controls">
           <button type="button" onClick={togglePlay} disabled={!!question} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
           <input type="range" min="0" max={Math.max(1, Math.floor(duration))} value={Math.min(time, duration || 1)} onChange={seek} disabled={!!question} aria-label="Video progress" />
           <span>{fmt(time)} / {fmt(duration)}</span>
           <select value={speed} disabled={!!question} onChange={e => { const n = Number(e.target.value); setSpeed(n); playerRef.current?.setPlaybackRate?.(n); }} className="student-playback-speed" aria-label="Playback speed">
             {[1,1.25,1.5,1.75,2].filter(n => n <= Number(video.playback_speed || 2)).map(n => <option key={n} value={n}>{n}×</option>)}
           </select>
           <button type="button" onClick={() => { playerRef.current?.isMuted() ? playerRef.current.unMute() : playerRef.current.mute(); setMuted(!muted); }} aria-label="Mute">{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
           <button type="button" onClick={() => fullscreenRef.current?.requestFullscreen?.()} aria-label="Fullscreen"><Maximize size={16}/></button>
         </div>
       </div>
       <div className="student-player-meta">
         <div className="student-player-meta-row"><span>Watched</span><strong>{fmt(maxWatched)} / {fmt(duration)}</strong></div>
         <div className="student-progress-track"><div style={{width:`${duration ? Math.min(100, maxWatched / duration * 100) : 0}%`}} /></div>
         <div className="student-player-meta-grid">
           <span>Questions <b>{solved}/{questions.length}</b></span>
           <span>Correct <b>{correct}/{questions.length}</b></span>
           <span>Status <b>{duration > 0 && maxWatched >= duration - 2 && solved >= questions.length ? 'Completed' : 'In Progress'}</b></span>
         </div>
       </div>
     </div>
     {question && <QuestionPanel question={question} selected={selected} setSelected={setSelected} explanation={explanation} submit={submit} rewatch={rewatch} saving={saving}/> }
   </div>
   {video.block_forward_seek && <div className="student-player-note">Forward seeking is restricted until the corresponding part of the video has been watched.</div>}
 </section>
}
function QuestionPanel({question,selected,setSelected,explanation,submit,rewatch,saving}){return <aside className="student-question-panel">
  <div className="student-question-status">Question at this point in the video · {fmt(question.timestamp_seconds)}</div>
  <h3>Question</h3>
  <p className="student-question-text">{question.question_text}</p>
  <div className="student-question-options">{[...(question.question_options||[])].sort((a,b)=>Number(a.option_order)-Number(b.option_order)).map(o=><label key={o.option_id} className={`student-option ${String(selected)===String(o.option_id)?'selected':''}`}><input type="radio" name="student-question" checked={String(selected)===String(o.option_id)} onChange={()=>setSelected(String(o.option_id))}/><span>{o.option_text}</span></label>)}</div>
  {explanation&&<div className="student-question-feedback"><CheckCircle2 size={17}/><span>{explanation}</span></div>}
  <div className="student-question-actions"><button onClick={rewatch} disabled={saving} className="student-secondary-btn"><RotateCcw size={15}/> Rewatch 15s</button><button onClick={submit} disabled={!selected||saving} className="student-primary-btn">{saving?'Saving...':'Submit'}</button></div>
</aside>}

function Row({label,value}){return <div className="flex justify-between gap-4"><span className="text-slate-500">{label}</span><b className="text-slate-800">{value}</b></div>}
function fmt(s){const n=Math.max(0,Math.floor(Number(s)||0));const m=Math.floor(n/60),sec=n%60;return `${m}:${String(sec).padStart(2,'0')}`}
function extract(url){const m=String(url||'').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);return m?.[1]||''}
