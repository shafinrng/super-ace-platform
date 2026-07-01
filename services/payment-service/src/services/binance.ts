import crypto from "crypto";
import axios from "axios";
const BASE = process.env.BINANCE_BASE_URL || "https://bpay.binanceapi.com";
const KEY = process.env.BINANCE_API_KEY || "";
const SECRET = process.env.BINANCE_SECRET_KEY || "";
function sign(payload: string, ts: string, nonce: string) {
  return crypto.createHmac("sha512", SECRET).update(`${ts}\n${nonce}\n${payload}\n`).digest("hex").toUpperCase();
}
function nonce(n=32){ return crypto.randomBytes(n).toString("hex").slice(0,n); }
export async function createBinanceOrder(p: { merchantTradeNo:string; orderAmount:number; currency:string; description:string; userId:string; }) {
  const ts=Date.now().toString(), nc=nonce();
  const payload=JSON.stringify({
    env:{terminalType:"WEB"},
    merchantTradeNo:p.merchantTradeNo,
    orderAmount:p.orderAmount,
    currency:p.currency,
    goods:{goodsType:"02",goodsCategory:"Z000",referenceGoodsId:"superace-deposit",goodsName:"Super Ace Deposit",goodsDetail:p.description},
    buyer:{referenceBuyerId:p.userId},
  });
  const r=await axios.post(`${BASE}/binancepay/openapi/v2/order`,payload,{
    headers:{"Content-Type":"application/json","BinancePay-Timestamp":ts,"BinancePay-Nonce":nc,"BinancePay-Certificate-SN":KEY,"BinancePay-Signature":sign(payload,ts,nc)}
  });
  return r.data;
}
export async function queryBinanceOrder(merchantTradeNo: string) {
  const ts=Date.now().toString(), nc=nonce();
  const payload=JSON.stringify({merchantTradeNo});
  const r=await axios.post(`${BASE}/binancepay/openapi/v1/order/query`,payload,{
    headers:{"Content-Type":"application/json","BinancePay-Timestamp":ts,"BinancePay-Nonce":nc,"BinancePay-Certificate-SN":KEY,"BinancePay-Signature":sign(payload,ts,nc)}
  });
  return r.data;
}
