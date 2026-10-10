const router=require('express').Router();
const {pool}=require('../config/database');
const {auth}=require('../middleware/auth');
const {asyncRoute}=require('../middleware/errorHandler');
const {transaction}=require('../services/transaction');
const {createReport}=require('../services/reportService');
const v=require('../services/validation');
router.use(auth);
router.get('/mine',asyncRoute(async(req,res)=>{
  const {rows}=await pool.query(`SELECT report_id,target_type,target_snapshot,reason,description,status,
    resolution_note,resolution_action,created_at,reviewed_at FROM report WHERE reporter_id=$1 ORDER BY created_at DESC,report_id DESC`,[req.user.userId]);
  res.json({reports:rows});
}));
router.post('/',asyncRoute(async(req,res)=>{
  const reason=v.text(req.body.reason,'Reason',160,true);
  const description=v.text(req.body.description,'What happened',3000,true);
  const note=v.text(req.body.evidence_note,'Evidence note',1000);
  const report=await transaction(async client=>{
    let targetId=v.number(req.body.user_id,'User ID',null,1,2147483647),type='user',evidence={note};
    if(req.body.conversation_id!=null){
      const conversationId=v.number(req.body.conversation_id,'Conversation ID',null,1,2147483647);
      const messageId=v.number(req.body.message_id,'Message ID',null,1,2147483647);
      if(!Number.isInteger(conversationId)||!Number.isInteger(messageId))
        throw v.invalid('Select a message from this conversation.');
      const {rows:[message]}=await client.query(`SELECT m.message_id,m.body,m.created_at,m.sender_id,m.conversation_id
        FROM flatmate_message m JOIN flatmate_conversation c USING(conversation_id)
        WHERE c.conversation_id=$1 AND m.message_id=$2 AND $3 IN(c.member_low,c.member_high)`,
        [conversationId,messageId,req.user.userId]);
      if(!message)
        throw v.invalid('Conversation or message not found.',404);
      targetId=message.sender_id;type='flatmate_message';
      evidence={note,message_id:message.message_id,conversation_id:message.conversation_id,
        body:message.body,sender_id:message.sender_id,sent_at:message.created_at};
    }
    if(!Number.isInteger(targetId)||targetId===req.user.userId)
      throw v.invalid('Choose another user to report.');
    const {rows:[user]}=await client.query('SELECT user_id,full_name FROM users WHERE user_id=$1',[targetId]);
    if(!user)
      throw v.invalid('User not found.',404);
    return createReport(client,{reporterId:req.user.userId,userId:targetId,type,reason,description,
      snapshot:{user_id:user.user_id,name:user.full_name},evidence});
  });
  res.status(201).json({report_id:report.report_id,message:'Report sent to administrators. Track the outcome in your dashboard.'});
}));
module.exports=router;
