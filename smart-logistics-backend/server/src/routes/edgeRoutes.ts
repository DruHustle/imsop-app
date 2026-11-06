import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {Router, type Request, type Response} from 'express';
import {z} from 'zod';
import {connection} from '../config/db';
import {authenticate, authorize, requireWorkspace, type AuthRequest} from '../middleware/auth';

import {edgeIdentity as identity, smartLogisticsEdgeGateways} from '../config/edge';
export {smartLogisticsEdgeGateways} from '../config/edge';

const common=z.object({
  schemaVersion:z.literal(1),eventId:z.string().uuid(),sourceId:identity,
  observedAt:z.iso.datetime({offset:true})
});
export const imsopEdgeEvent=z.discriminatedUnion('kind',[
  common.extend({
    kind:z.literal('truck_gps'),
    data:z.object({
      vehicleId:identity, latitude:z.number().min(-90).max(90),
      longitude:z.number().min(-180).max(180),
      accuracyM:z.number().nonnegative().max(100000).optional(),
      speedKph:z.number().nonnegative().max(300).optional(),
      trackingNumber:z.string().trim().min(1).max(100).optional()
    }).strict()
  }).strict(),
  common.extend({
    kind:z.literal('warehouse_sensor'),
    data:z.object({
      warehouseId:identity,assetId:identity,metric:identity,
      value:z.number().finite(),unit:z.string().trim().min(1).max(32)
    }).strict()
  }).strict()
]);

export function verifyEdgeHmac(raw:Buffer, timestamp:string|undefined,
                              signature:string|undefined,secret:string,nowMs=Date.now()):boolean{
  if(!timestamp||!/^\d{10}$/.test(timestamp)||!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  if(Math.abs(nowMs/1000-Number(timestamp))>300)return false;
  const expected='sha256='+createHmac('sha256',secret)
    .update(timestamp).update('.').update(raw).digest('hex');
  return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}

function stable(value:unknown):unknown{
  if(Array.isArray(value))return value.map(stable);
  if(value!==null&&typeof value==='object')
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,stable(item)]));
  return value;
}

export const smartLogisticsEdgeRouter=Router();

smartLogisticsEdgeRouter.post('/:gatewayId/events',async(req:Request,res:Response)=>{
  const parsedGateway=identity.safeParse(req.params.gatewayId);
  if(!parsedGateway.success)return res.status(404).json({error:'unknown_gateway'});
  const gateway=smartLogisticsEdgeGateways()[parsedGateway.data];
  if(!gateway||!req.rawBody||req.rawBody.length>16384||
     !verifyEdgeHmac(req.rawBody,req.header('x-edge-timestamp'),
                     req.header('x-edge-signature'),gateway.secret))
    return res.status(401).json({error:'unauthorized_edge'});
  const parsed=imsopEdgeEvent.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'invalid_edge_event'});
  const event=parsed.data;
  if(!gateway.sources.includes(event.sourceId))
    return res.status(403).json({error:'source_not_commissioned'});
  if(Date.parse(event.observedAt)>Date.now()+300000)
    return res.status(422).json({error:'future_observation'});
  const digest=createHash('sha256').update(JSON.stringify(stable(event))).digest('hex');
  try{
    const saved=await connection.query(
      'INSERT INTO edge_observations '+
      '(workspace_id,gateway_id,event_id,source_id,kind,observed_at,payload,payload_hash) '+
      'VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) '+
      'ON CONFLICT(workspace_id,gateway_id,event_id) DO NOTHING RETURNING event_id',
      [gateway.workspaceId,parsedGateway.data,event.eventId,event.sourceId,event.kind,
       event.observedAt,JSON.stringify(event),digest]
    );
    if(!saved.rowCount){
      const old=await connection.query(
        'SELECT payload_hash FROM edge_observations WHERE workspace_id=$1 AND gateway_id=$2 AND event_id=$3',
        [gateway.workspaceId,parsedGateway.data,event.eventId]
      );
      return old.rows[0]?.payload_hash===digest
        ?res.status(202).json({accepted:true,duplicate:true})
        :res.status(409).json({error:'event_identity_conflict'});
    }
    return res.status(202).json({accepted:true,duplicate:false});
  }catch{
    return res.status(503).json({error:'edge_observations_unavailable'});
  }
});

smartLogisticsEdgeRouter.get('/observations',
  authenticate, requireWorkspace, authorize(['admin','engineer','analyst']),
  async(req:AuthRequest,res:Response)=>{
    try{
      const rows=await connection.query(
        'SELECT gateway_id as "gatewayId",event_id as "eventId", '+
        'source_id as "sourceId",kind,observed_at as "observedAt", '+
        'received_at as "receivedAt",payload FROM edge_observations '+
        'WHERE workspace_id=$1 ORDER BY received_at DESC,event_id DESC LIMIT 100',
        [req.user!.workspaceId]
      );
      return res.json({items:rows.rows,evidence:'Unverified GPS/sensor readings until device commissioning',commandCapability:false});
    }catch{
      return res.status(503).json({error:'edge_observations_unavailable'});
    }
  }
);
