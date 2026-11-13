// Kevin MacLeod tracks (CC BY 4.0, credits in index.html). energy 1..5 = how hard the track pushes the floor (for 選曲).
export const TRACKS = {
 danceMonster: {file:'km__dance-monster.mp3',title:'Dance Monster',bpm:120,firstBeat:.006,key:'A minor',camelot:'8A',energy:3,isrc:'USUAN1100272',trimDb:0},
 digitalLemonade: {file:'km__digital-lemonade.mp3',title:'Digital Lemonade',bpm:120,firstBeat:0,key:'C major',camelot:'8B',energy:2,isrc:'USUAN1700010',trimDb:0},
 ravingEnergy: {file:'km__raving-energy.mp3',title:'Raving Energy',bpm:122,firstBeat:.006,key:'F major',camelot:'7B',energy:5,isrc:'USUAN1900013',trimDb:0},
 cutAndDry: {file:'km__cut-and-dry.mp3',title:'Cut and Dry',bpm:122,firstBeat:.006,key:'D minor',camelot:'7A',energy:3,isrc:'USUAN1100852',trimDb:0},
 risingTide: {file:'km__rising-tide-faster.mp3',title:'Rising Tide (faster)',bpm:122,firstBeat:.486,key:'A minor',camelot:'8A',energy:4,isrc:'USUAN1900011',trimDb:5}
};
// A SET opens with a fixed pair (tracks[0] on A, tracks[1] on B) and plays `count` tracks in all. After the first
// transition the player picks each next track from two candidates (選曲, DJS17).
// detune: 'match' = every incoming track arrives already at the playing track's tempo (SET 1: nothing to match),
//         'random' = the incoming track arrives ±1.2〜2.8 % off and the player matches it with PITCH (or SYNC),
//         'none' = native tempo (SET 3: 120 and 122 BPM tracks meet, so the pitch has to be moved).
export const SETS = [
 {name:'SET 1',label:'入門・BPM合わせなし',tracks:['danceMonster','digitalLemonade'],count:3,detune:'match'},
 {name:'SET 2',label:'本命・ピッチ合わせ',tracks:['ravingEnergy','cutAndDry'],count:4,detune:'random'},
 {name:'SET 3',label:'ピッチ課題・120↔122',tracks:['risingTide','danceMonster'],count:4,detune:'none'}
];
export const STAGES = SETS; // old name kept for the host (?stage=)
export function buildTrackData(channelData, sampleRate, cfg) {
 const duration=channelData.length/sampleRate, peaks=new Float32Array(8192);
 for(let i=0;i<channelData.length;i++){const bucket=Math.floor(i*8192/channelData.length);peaks[bucket]=Math.max(peaks[bucket],Math.abs(channelData[i]));}
 return {nativeBpm:cfg.bpm,duration,firstBeat:cfg.firstBeat,beats:Math.floor(((duration-cfg.firstBeat)*cfg.bpm/60)/4)*4,peaks};
}
export function peakAt(track, sec) {return track.peaks[Math.max(0,Math.min(track.peaks.length-1,Math.floor(sec/track.duration*track.peaks.length)))];}
