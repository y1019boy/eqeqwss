import { useEffect, useState, useMemo } from 'react';
import { MapContainer, GeoJSON, Marker, useMap, Pane, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import areaCentroidsData from './areaCentroids.json';
import cityToAreaData from './cityToArea.json';

type P2PQuakeInfo = {
  id: string;
  code: number;
  time: string;
  issue: {
    source: string;
    time: string;
    type: string;
  };
  earthquake: {
    time: string;
    hypocenter: {
      name: string;
      latitude: number;
      longitude: number;
      depth: number;
      magnitude: number;
    };
    maxScale: number;
    domesticTsunami: string;
  };
  points: {
    pref: string;
    addr: string;
    isArea: boolean;
    scale: number;
  }[];
};

const getScaleColor = (scale: number) => {
  switch (scale) {
    case 10: return '#3a5b6c'; // 震度1
    case 20: return '#1e73ff'; // 震度2
    case 30: return '#ff9900'; // 震度3 (オレンジ色に変更)
    case 40: return '#fae600'; // 震度4
    case 45: return '#ffe600'; // 震度5弱
    case 50: return '#ff9900'; // 震度5強
    case 55: return '#ff2800'; // 震度6弱
    case 60: return '#a50021'; // 震度6強
    case 70: return '#b40068'; // 震度7
    default: return '#4a4a4a';
  }
};

const getScaleString = (scale: number) => {
  switch (scale) {
    case 10: return '1';
    case 20: return '2';
    case 30: return '3';
    case 40: return '4';
    case 45: return '5弱';
    case 50: return '5強';
    case 55: return '6弱';
    case 60: return '6強';
    case 70: return '7';
    default: return '?';
  }
};

const getTsunamiString = (tsunami: string) => {
  switch (tsunami) {
    case 'None': return '津波の心配はありません';
    case 'Unknown': return '津波の影響は不明です';
    case 'Checking': return '津波の影響を現在調査中です';
    case 'NonEffective': return '若干の海面変動が予想されますが、被害の心配はありません';
    case 'Watch': return '津波注意報が発表されています';
    case 'Warning': return '津波警報等が発表されています';
    default: return '津波の情報は不明です';
  }
};

const getIssueTypeString = (type: string) => {
  switch (type) {
    case 'ScalePrompt': return '震度速報';
    case 'Destination': return '震源に関する情報';
    case 'ScaleAndDestination': return '震源・震度に関する情報';
    case 'DetailScale': return '各地の震度に関する情報';
    case 'Foreign': return '遠地地震に関する情報';
    default: return '地震情報';
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}年 ${month}月${day}日${hours}:${minutes}`;
};

const crossIcon = L.divIcon({
  className: 'custom-cross-icon',
  html: '<div style="color: #cc0000; font-size: 50px; font-weight: bold; text-shadow: 3px 3px 0 #fff, -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff, 0 3px 0 #fff, 0 -3px 0 #fff; line-height: 1; transform: translate(-50%, -50%);">×</div>',
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

const createScaleIcon = (scale: number) => {
  return L.divIcon({
    className: 'custom-scale-icon',
    html: `
      <div style="background-color: ${getScaleColor(scale)}; border: 1px solid rgba(255,255,255,0.8); width: 28px; height: 28px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 14px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); border-radius: 4px; transform: translate(-50%, -50%);">
        ${getScaleString(scale)}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

function MapController({ quakeInfo }: { quakeInfo: P2PQuakeInfo | null }) {
  const map = useMap();
  useEffect(() => {
    if (quakeInfo && quakeInfo.earthquake?.hypocenter?.latitude && quakeInfo.earthquake.hypocenter.latitude !== -200) {
      const { latitude, longitude } = quakeInfo.earthquake.hypocenter;
      map.setView([latitude, longitude], 8, { animate: true });
    } else if (quakeInfo && quakeInfo.points && quakeInfo.points.length > 0) {
      // 震央情報がない場合（震度速報など）は、最大震度の観測点付近にズーム
      const maxScale = quakeInfo.earthquake?.maxScale || -1;
      const maxPoint = quakeInfo.points.find(p => p.scale === maxScale);
      if (maxPoint) {
        const normalize = (str: string) => str.replace(/\s+/g, '');
        const normAddr = normalize(maxPoint.addr);
        let pos: [number, number] | null = null;
        
        if (maxPoint.isArea) {
          const area = areaCentroidsData.find((a: any) => {
            const normName = normalize(a.name);
            return normAddr === normName || normAddr.includes(normName) || normName.includes(normAddr);
          });
          if (area) pos = [area.lat, area.lng];
        } else {
          const targetArea = (cityToAreaData as Record<string, string>)[maxPoint.addr];
          if (targetArea) {
            const area = areaCentroidsData.find((a: any) => a.name === targetArea);
            if (area) pos = [area.lat, area.lng];
          }
        }
        
        if (pos) {
          map.setView(pos, 8, { animate: true });
        }
      }
    }
  }, [quakeInfo, map]);
  return null;
}

export default function App() {
  const [geoData, setGeoData] = useState<{ japan: any; world: any } | null>(null);
  const [quakeInfo, setQuakeInfo] = useState<P2PQuakeInfo | null>(null);

  const fetchAndMergeQuakeInfo = async () => {
    try {
      console.log('Fetching quake history...');
      const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=20');
      const data = await res.json();
      console.log('Quake history data:', data);
      if (data && data.length > 0) {
        const latest = data[0];
        
        // 履歴データ全体から最新の地震時刻のポイントを抽出
        // 複数の地震情報が混在する可能性があるため、最も新しい地震の時刻を基準にする
        const latestEarthquakeTime = data[0].earthquake?.time;
        
        const areaPoints = new Map();
        let maxScale = latest.earthquake?.maxScale || -1;
        
        data.forEach((item: any) => {
          if (item.earthquake?.time === latestEarthquakeTime) {
            if (item.earthquake?.maxScale > maxScale) {
              maxScale = item.earthquake.maxScale;
            }
            item.points?.forEach((p: any) => {
              const existing = areaPoints.get(p.addr);
              if (!existing || existing.scale < p.scale) {
                areaPoints.set(p.addr, p);
              }
            });
          }
        });
        
        // latest.pointsを統合されたポイントで更新
        latest.points = Array.from(areaPoints.values());
        if (latest.earthquake) {
          latest.earthquake.maxScale = maxScale;
        }
        
        console.log('Setting quakeInfo:', latest);
        console.log('Sample point structure:', latest.points[0]);
        setQuakeInfo(latest);
      }
    } catch (err) {
      console.error('Error loading P2PQuake history:', err);
    }
  };

  useEffect(() => {
    const japanUrl = 'https://raw.githubusercontent.com/Ichihai1415/JMA-GIS-GeoJSON/release/AreaForecastLocalM_1saibun_GIS_20190125_01.geojson';
    const worldUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

    Promise.all([
      fetch(japanUrl).then(res => res.json()),
      fetch(worldUrl).then(res => res.json())
    ]).then(([japanData, worldData]) => {
      const filteredFeatures = worldData.features.filter(
        (feature: any) => feature.properties.ADMIN !== 'Japan'
      );
      setGeoData({
        japan: japanData,
        world: { ...worldData, features: filteredFeatures }
      });
    }).catch(err => console.error('Error loading GeoJSON:', err));

    fetchAndMergeQuakeInfo();

    const ws = new WebSocket('wss://api.p2pquake.net/v2/ws');
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.code === 551) {
          setTimeout(fetchAndMergeQuakeInfo, 1000);
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const centroids = useMemo(() => {
    if (!geoData?.japan || geoData.japan.type !== 'FeatureCollection') return {};
    const map: Record<string, [number, number]> = {};
    geoData.japan.features.forEach((feature: any) => {
      try {
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          const centroid = bounds.getCenter();
          map[feature.properties.name] = [centroid.lat, centroid.lng];
        }
      } catch (e) {
        console.error('Error calculating centroid for', feature.properties.name, e);
      }
    });
    console.log('Calculated centroids:', Object.keys(map).length);
    return map;
  }, [geoData]);

  // カスタムJSONレイヤーコンポーネント
  const CustomJsonLayer = ({ data, quakeInfo }: { data: any, quakeInfo: P2PQuakeInfo | null }) => {
    // data.items が配列の場合、または data 自体が配列の場合
    const points = data.items || (Array.isArray(data) ? data : []);
    
    return (
      <Pane name="custom-json-pane" style={{ zIndex: 500 }}>
        {points.map((pt: any, idx: number) => {
          let lat, lng, name;
          if (Array.isArray(pt) && pt.length >= 2) {
            lat = pt[0];
            lng = pt[1];
          } else if (pt && typeof pt === 'object') {
            lat = pt.lat || pt.latitude;
            lng = pt.lng || pt.lon || pt.longitude;
            name = pt.name || pt.regionName || pt.siteName;
          }
          
          if (lat === undefined || lng === undefined) return null;
          
          // 地震情報とのマッチング（名前がある場合）
          let scale = -1;
          if (name && quakeInfo?.points) {
            const normalize = (str: string) => str.replace(/\s+/g, '');
            const normName = normalize(name);
            const matchedPoint = quakeInfo.points.find((p: any) => {
              const normAddr = normalize(p.addr);
              return normAddr === normName || normName.includes(normAddr) || normAddr.includes(normName);
            });
            if (matchedPoint) {
              scale = matchedPoint.scale;
            }
          }
          
          const color = scale >= 0 ? getScaleColor(scale) : '#888888';
          const radius = scale >= 0 ? 6 : 2;
          const fillOpacity = scale >= 0 ? 1 : 0.5;
          
          return (
            <CircleMarker 
              key={idx} 
              center={[lat, lng]} 
              radius={radius}
              pathOptions={{ color: color, fillColor: color, fillOpacity: fillOpacity, weight: 1 }}
            >
              {name && <Tooltip>{name}</Tooltip>}
            </CircleMarker>
          );
        })}
      </Pane>
    );
  };

  const getJapanStyle = () => {
    // 塗りつぶしなしのデフォルトスタイル
    return {
      fillColor: '#4a4a4a',
      weight: 1,
      opacity: 1,
      color: '#888888',
      fillOpacity: 1
    };
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[#111111]">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={[36, 137]} 
          zoom={5} 
          style={{ height: '100%', width: '100%', backgroundColor: '#111111' }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapController quakeInfo={quakeInfo} />
          {geoData && (
            <>
              <GeoJSON 
                data={geoData.world} 
                style={{ color: '#333333', weight: 1, fillColor: '#2a2a2a', fillOpacity: 1 }} 
              />
              {geoData.japan.type === 'FeatureCollection' ? (
                <Pane name="japan-pane" style={{ zIndex: 500 }}>
                  <GeoJSON 
                    key={quakeInfo ? JSON.stringify(quakeInfo.points) : 'japan'}
                    data={geoData.japan} 
                    style={getJapanStyle} 
                  />
                </Pane>
              ) : (
                <CustomJsonLayer data={geoData.japan} quakeInfo={quakeInfo} />
              )}
            </>
          )}
          
          {/* 震央マーカー */}
          {quakeInfo?.earthquake?.hypocenter?.latitude && quakeInfo.earthquake.hypocenter.latitude !== -200 && (
            <Marker 
              position={[quakeInfo.earthquake.hypocenter.latitude, quakeInfo.earthquake.hypocenter.longitude]} 
              icon={crossIcon} 
            />
          )}

          {/* 震度アイコン */}
          {quakeInfo && (() => {
            // 375区域ごとの最大震度を計算
            const areaMaxScales: Record<string, number> = {};
            
            quakeInfo.points.forEach((point: any) => {
              const normalize = (str: string) => str.replace(/\s+/g, '');
              const normAddr = normalize(point.addr);
              
              let targetArea = null;
              
              if (point.isArea) {
                // すでに地域名の場合は、そのままマッチングを試みる
                const area = areaCentroidsData.find((a: any) => {
                  const normName = normalize(a.name);
                  return normAddr === normName || normAddr.includes(normName) || normName.includes(normAddr);
                });
                if (area) targetArea = area.name;
              } else {
                // 市町村名の場合は、cityToAreaマッピングを使って地域名に変換
                // 完全一致で探す
                targetArea = (cityToAreaData as Record<string, string>)[point.addr];
                
                // 見つからなければ正規化して探す
                if (!targetArea) {
                  const cityKey = Object.keys(cityToAreaData).find(k => {
                    const normKey = normalize(k);
                    return normAddr === normKey || normAddr.includes(normKey) || normKey.includes(normAddr);
                  });
                  if (cityKey) targetArea = (cityToAreaData as Record<string, string>)[cityKey];
                }
              }
              
              if (targetArea) {
                if (!areaMaxScales[targetArea] || areaMaxScales[targetArea] < point.scale) {
                  areaMaxScales[targetArea] = point.scale;
                }
              }
            });

            // 計算された各地域の最大震度を描画
            return Object.entries(areaMaxScales).map(([areaName, scale], idx) => {
              const areaInfo = areaCentroidsData.find((a: any) => a.name === areaName);
              if (!areaInfo) return null;
              
              return (
                <Marker 
                  key={idx} 
                  position={[areaInfo.lat, areaInfo.lng]} 
                  icon={createScaleIcon(scale)} 
                />
              );
            });
          })()}
        </MapContainer>
      </div>

      {/* Info Panel (Top Left) */}
      {quakeInfo && (
        <div className="absolute top-6 left-6 z-10 bg-black/80 border border-white/30 p-5 rounded shadow-[0_0_20px_rgba(255,255,255,0.4)] text-white font-sans w-80">
          <div className="text-xl text-center mb-1">{formatTime(quakeInfo.earthquake.time)}頃</div>
          
          {quakeInfo.issue.type === 'ScalePrompt' ? (() => {
            const maxScale = quakeInfo.earthquake.maxScale;
            const maxPoints = quakeInfo.points.filter(p => p.scale === maxScale);
            const areaNames = Array.from(new Set(maxPoints.map(p => p.addr)));
            const areaText = areaNames.length > 0 ? (areaNames.length <= 2 ? areaNames.join('、') : `${areaNames[0]}等`) : '不明な地域';
            
            return (
              <>
                <div className="text-2xl text-center mb-6">{areaText}で震度{getScaleString(maxScale)}を観測</div>
                
                <div className="text-lg leading-relaxed mb-8">
                  最大震度{getScaleString(maxScale)}を{areaText}で観測。<br/>
                  今後の情報にご注意ください。<br/>
                  なお、地震の規模や津波の有無<br/>
                  震源地は気象庁が調査中です。<br/>
                  今後の情報に注意してください。
                </div>
              </>
            );
          })() : (
            <>
              <div className="text-2xl text-center mb-6">{quakeInfo.earthquake.hypocenter.name}で発生</div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-10" style={{ backgroundColor: getScaleColor(quakeInfo.earthquake.maxScale) }}></div>
                <div className="text-4xl font-bold">最大震度:{getScaleString(quakeInfo.earthquake.maxScale)}</div>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 bg-[#00ff00]"></div>
                <div className="text-2xl">規模 : M{quakeInfo.earthquake.hypocenter.magnitude !== -1 ? quakeInfo.earthquake.hypocenter.magnitude.toFixed(1) : '不明'}</div>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 bg-gray-500"></div>
                <div className="text-2xl">深さ : {quakeInfo.earthquake.hypocenter.depth === 0 ? 'ごく浅い' : quakeInfo.earthquake.hypocenter.depth !== -1 ? `${quakeInfo.earthquake.hypocenter.depth}km` : '不明'}</div>
              </div>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-5 h-5 bg-gray-500 shrink-0"></div>
                <div className="text-xl leading-tight">{getTsunamiString(quakeInfo.earthquake.domesticTsunami)}</div>
              </div>
            </>
          )}
          
          <div className="text-xs text-gray-400 font-bold leading-relaxed">
            Powerd by p2p地震情報websocket<br/>
            気象庁「予報区分等GISデータ」を加工して作成
          </div>
        </div>
      )}

      {/* Bottom Ticker */}
      {quakeInfo && (
        <div className="absolute bottom-0 left-0 w-full z-10 bg-black text-white py-3 px-6 border-t-2 border-white/50 shadow-[0_-10px_20px_rgba(255,255,255,0.2)]">
          <div className="text-3xl font-bold text-center tracking-wide">
            有感地震　{getIssueTypeString(quakeInfo.issue.type)}　{formatTime(quakeInfo.earthquake.time)}頃 に発生
          </div>
        </div>
      )}
    </div>
  );
}
