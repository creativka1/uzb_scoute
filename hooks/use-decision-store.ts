'use client';
import {useEffect,useState} from 'react';
import {decisionStorageKey,emptyDecisionStore,parseDecisionStore} from '@/lib/decisions';
import type {DecisionStore} from '@/types/decisions';
const eventName='uzstat-decisions-changed';
export function useDecisionStore(){
  const [store,setStore]=useState<DecisionStore>(emptyDecisionStore),[ready,setReady]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{const read=()=>{try{setStore(parseDecisionStore(localStorage.getItem(decisionStorageKey)));setReady(true);setError(false);}catch{setReady(false);setError(true);}};read();window.addEventListener(eventName,read);window.addEventListener('storage',read);return()=>{window.removeEventListener(eventName,read);window.removeEventListener('storage',read);};},[]);
  const update=(change:(current:DecisionStore)=>DecisionStore)=>{if(!ready)return false;try{const next=change(parseDecisionStore(localStorage.getItem(decisionStorageKey)));const raw=JSON.stringify(next);parseDecisionStore(raw);localStorage.setItem(decisionStorageKey,raw);setStore(next);setError(false);window.dispatchEvent(new Event(eventName));return true;}catch{setError(true);return false;}};
  return {store,ready,error,update};
}
