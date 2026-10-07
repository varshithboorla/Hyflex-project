import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();
router.use((req,res,next)=>{ if(!req.session.user || req.session.user.role!=='admin') return res.status(401).json({message:'Admin authentication required.'}); next(); });

const fail=(res,e,msg)=>{ console.error(msg,e); return res.status(500).json({message:e?.message||msg}); };

router.get('/videos', async (req,res)=>{
  try{
    const offeringId = req.query.offering_id ? Number(req.query.offering_id) : null;
    let q=supabase.from('videos').select('video_id,offering_id,video_title,youtube_url,description,display_order,block_forward_seek,pause_at_questions,playback_speed,start_date,end_date,created_at,updated_at').order('display_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true});
    if(offeringId) q=q.eq('offering_id',offeringId);
    const {data,error}=await q; if(error) throw error;
    res.json({videos:data||[]});
  }catch(e){fail(res,e,'Failed to load videos.');}
});

router.get(['/videos/:id','/videos/:id/editor'], async(req,res)=>{
  try{
    const id=Number(req.params.id);
    const v=await supabase.from('videos').select('video_id,offering_id,video_title,youtube_url,description,display_order,block_forward_seek,pause_at_questions,playback_speed,start_date,end_date,created_at,updated_at').eq('video_id',id).single();
    if(v.error) throw v.error;
    const [qs,skips]=await Promise.all([
      supabase.from('video_questions').select('question_id,timestamp_seconds,question_text,explanation,question_options(option_id,option_text,option_order,is_correct)').eq('video_id',id).order('timestamp_seconds'),
      supabase.from('video_skips').select('skip_id,start_time_seconds,end_time_seconds').eq('video_id',id).order('start_time_seconds')
    ]);
    if(qs.error) throw qs.error; if(skips.error) throw skips.error;
    res.json({video:v.data,questions:qs.data||[],skips:skips.data||[]});
  }catch(e){fail(res,e,'Failed to load video editor.');}
});

router.post('/videos', async(req,res)=>{
  try{
    const b=req.body||{}; const offeringId=Number(b.offering_id); const title=String(b.video_title||'').trim(); const url=String(b.youtube_url||'').trim();
    if(!offeringId||!title||!url) return res.status(400).json({message:'Course, video title, and YouTube URL are required.'});
    const max=await supabase.from('videos').select('display_order').eq('offering_id',offeringId).order('display_order',{ascending:false}).limit(1);
    if(max.error) throw max.error;
    const order=Number(max.data?.[0]?.display_order||0)+1;
    const {data,error}=await supabase.from('videos').insert({offering_id:offeringId,video_title:title,youtube_url:url,description:String(b.description||'').trim()||null,display_order:order,block_forward_seek:b.block_forward_seek!==false,pause_at_questions:b.pause_at_questions!==false,playback_speed:Number(b.playback_speed||1),start_date:b.start_date||null,end_date:b.end_date||null}).select().single();
    if(error) throw error; res.status(201).json({video:data});
  }catch(e){fail(res,e,'Failed to create video.');}
});

router.patch('/videos/:id', async(req,res)=>{
  try{
    const id=Number(req.params.id); const b=req.body||{};
    const patch={};
    if(b.video_title!==undefined) patch.video_title=String(b.video_title).trim();
    if(b.youtube_url!==undefined) patch.youtube_url=String(b.youtube_url).trim();
    if(b.description!==undefined) patch.description=String(b.description).trim()||null;
    if(b.offering_id!==undefined) patch.offering_id=Number(b.offering_id);
    if(b.block_forward_seek!==undefined) patch.block_forward_seek=!!b.block_forward_seek;
    if(b.pause_at_questions!==undefined) patch.pause_at_questions=!!b.pause_at_questions;
    if(b.playback_speed!==undefined) patch.playback_speed=Number(b.playback_speed);
    if(b.start_date!==undefined) patch.start_date||=b.start_date||null;
    if(b.end_date!==undefined) patch.end_date=b.end_date||null;
    patch.updated_at=new Date().toISOString();
    const {data,error}=await supabase.from('videos').update(patch).eq('video_id',id).select().single(); if(error) throw error; res.json({video:data});
  }catch(e){fail(res,e,'Failed to update video.');}
});

router.put('/videos/:id/editor', async(req,res)=>{
  try{
    const id=Number(req.params.id); const b=req.body||{};
    const settings={block_forward_seek:b.block_forward_seek!==false,pause_at_questions:b.pause_at_questions!==false,playback_speed:Number(b.playback_speed||1),start_date:b.start_date||null,end_date:b.end_date||null,updated_at:new Date().toISOString()};
    if(settings.start_date && settings.end_date && settings.end_date < settings.start_date) return res.status(400).json({message:'End date cannot be earlier than the start date.'});
    const upd=await supabase.from('videos').update(settings).eq('video_id',id); if(upd.error) throw upd.error;
    const old=await supabase.from('video_questions').select('question_id').eq('video_id',id); if(old.error) throw old.error;
    const ids=(old.data||[]).map(x=>x.question_id);
    if(ids.length){const r=await supabase.from('question_options').delete().in('question_id',ids); if(r.error) throw r.error;}
    const dq=await supabase.from('video_questions').delete().eq('video_id',id); if(dq.error) throw dq.error;
    for(const q of Array.isArray(b.questions)?b.questions:[]){
      const ins=await supabase.from('video_questions').insert({video_id:id,timestamp_seconds:Math.round(Number(q.time)||0),question_text:String(q.question||'').trim(),explanation:String(q.explanation||'').trim()||null}).select('question_id').single();
      if(ins.error) throw ins.error;
      const opts=(Array.isArray(q.options)?q.options:[]).map((text,i)=>({question_id:ins.data.question_id,option_text:String(text||'').trim(),option_order:i,is_correct:i===Number(q.correctAnswer)}));
      if(opts.length){const io=await supabase.from('question_options').insert(opts); if(io.error) throw io.error;}
    }
    const ds=await supabase.from('video_skips').delete().eq('video_id',id); if(ds.error) throw ds.error;
    const skips=(Array.isArray(b.skips)?b.skips:[]).map(s=>({video_id:id,start_time_seconds:Math.round(Number(s.start)||0),end_time_seconds:Math.round(Number(s.end)||0)})).filter(s=>s.end_time_seconds>s.start_time_seconds);
    if(skips.length){const ins=await supabase.from('video_skips').insert(skips); if(ins.error) throw ins.error;}
    res.json({message:`Saved ${Array.isArray(b.questions)?b.questions.length:0} question(s), ${skips.length} skip(s).`});
  }catch(e){fail(res,e,'Failed to save video editor data.');}
});

router.delete('/videos/:id', async(req,res)=>{
  try{
    const id=Number(req.params.id); const cur=await supabase.from('videos').select('offering_id').eq('video_id',id).single(); if(cur.error) throw cur.error;
    const qs=await supabase.from('video_questions').select('question_id').eq('video_id',id); if(qs.error) throw qs.error;
    const qids=(qs.data||[]).map(x=>x.question_id);
    if(qids.length){const r=await supabase.from('question_options').delete().in('question_id',qids); if(r.error) throw r.error;}
    for(const table of ['video_questions','video_skips']){const r=await supabase.from(table).delete().eq('video_id',id); if(r.error) throw r.error;}
    const del=await supabase.from('videos').delete().eq('video_id',id); if(del.error) throw del.error;
    const rest=await supabase.from('videos').select('video_id,display_order,created_at').eq('offering_id',cur.data.offering_id).order('display_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}); if(rest.error) throw rest.error;
    for(let i=0;i<(rest.data||[]).length;i++){const r=await supabase.from('videos').update({display_order:i+1}).eq('video_id',rest.data[i].video_id); if(r.error) throw r.error;}
    res.json({message:'Video deleted and remaining video positions normalized.'});
  }catch(e){fail(res,e,'Failed to delete video.');}
});

router.post('/videos/:id/move', async(req,res)=>{
  try{
    const id=Number(req.params.id); const direction=req.body?.direction==='up'?'up':'down'; const cur=await supabase.from('videos').select('video_id,offering_id,display_order').eq('video_id',id).single(); if(cur.error) throw cur.error;
    const list=await supabase.from('videos').select('video_id,display_order,created_at').eq('offering_id',cur.data.offering_id).order('display_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}); if(list.error) throw list.error;
    const rows=list.data||[]; const idx=rows.findIndex(x=>x.video_id===id); const target=direction==='up'?idx-1:idx+1; if(idx<0||target<0||target>=rows.length) return res.json({message:'Already at the edge.'});
    let r=await supabase.from('videos').update({display_order:-1}).eq('video_id',id); if(r.error) throw r.error;
    r=await supabase.from('videos').update({display_order:idx+1}).eq('video_id',rows[target].video_id); if(r.error) throw r.error;
    r=await supabase.from('videos').update({display_order:target+1}).eq('video_id',id); if(r.error) throw r.error;
    res.json({message:`Video moved ${direction}.`});
  }catch(e){fail(res,e,'Failed to move video.');}
});

export default router;
