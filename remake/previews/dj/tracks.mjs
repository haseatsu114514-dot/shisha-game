// Kevin MacLeod tracks (CC BY 4.0, credits in index.html). A SET is the playlist the player mixes through, in order.
export const TRACKS = {
 danceMonster: {file:'km__dance-monster.mp3',title:'Dance Monster',bpm:120,firstBeat:.006,key:'A minor',camelot:'8A',isrc:'USUAN1100272',trimDb:0},
 digitalLemonade: {file:'km__digital-lemonade.mp3',title:'Digital Lemonade',bpm:120,firstBeat:0,key:'C major',camelot:'8B',isrc:'USUAN1700010',trimDb:0},
 ravingEnergy: {file:'km__raving-energy.mp3',title:'Raving Energy',bpm:122,firstBeat:.006,key:'F major',camelot:'7B',isrc:'USUAN1900013',trimDb:0},
 cutAndDry: {file:'km__cut-and-dry.mp3',title:'Cut and Dry',bpm:122,firstBeat:.006,key:'D minor',camelot:'7A',isrc:'USUAN1100852',trimDb:0},
 risingTide: {file:'km__rising-tide-faster.mp3',title:'Rising Tide (faster)',bpm:122,firstBeat:.486,key:'A minor',camelot:'8A',isrc:'USUAN1900011',trimDb:5}
};
// detune: 'none' = every incoming track arrives at its native tempo (SET 1: both 120, nothing to match),
//         'random' = the incoming track arrives ±1.2〜2.8 % off and the player matches it with PITCH (or SYNC).
export const SETS = [
 {name:'SET 1',label:'入門・BPM合わせなし',tracks:['danceMonster','digitalLemonade','danceMonster'],detune:'none'},
 {name:'SET 2',label:'本命・ピッチ合わせ',tracks:['ravingEnergy','cutAndDry','risingTide','ravingEnergy'],detune:'random'},
 {name:'SET 3',label:'ピッチ課題・120↔122',tracks:['risingTide','danceMonster','cutAndDry','digitalLemonade'],detune:'none'}
];
export const STAGES = SETS; // old name kept for the host (?stage=)
export function buildTrackData(channelData, sampleRate, cfg) {
 const duration=channelData.length/sampleRate, peaks=new Float32Array(8192);
 for(let i=0;i<channelData.length;i++){const bucket=Math.floor(i*8192/channelData.length);peaks[bucket]=Math.max(peaks[bucket],Math.abs(channelData[i]));}
 return {nativeBpm:cfg.bpm,duration,firstBeat:cfg.firstBeat,beats:Math.floor(((duration-cfg.firstBeat)*cfg.bpm/60)/4)*4,peaks};
}
export function peakAt(track, sec) {return track.peaks[Math.max(0,Math.min(track.peaks.length-1,Math.floor(sec/track.duration*track.peaks.length)))];}
