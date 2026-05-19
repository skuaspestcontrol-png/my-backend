import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { loadGooglePlacesScript } from '../utils/googlePlaces';

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toCenter = (latitude, longitude) => {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  if (lat === null || lng === null) return DEFAULT_CENTER;
  return { lat, lng };
};

const buildGoogleMapsUrl = (latitude, longitude) => {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  if (lat === null || lng === null) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

export default function MapPicker({
  latitude,
  longitude,
  onLocationChange,
  height = 180,
  onMapError,
  markerTitle = 'Lead location',
  unavailableMessage = 'Map preview unavailable. You can still save the lead manually.'
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const dragListenerRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onMapErrorRef = useRef(onMapError);
  const [readyState, setReadyState] = useState('loading');

  const hasCoordinates = useMemo(() => {
    return toNumber(latitude) !== null && toNumber(longitude) !== null;
  }, [latitude, longitude]);

  const mapsLink = useMemo(() => buildGoogleMapsUrl(latitude, longitude), [latitude, longitude]);
  const coordinateText = hasCoordinates
    ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
    : 'No location selected';

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onMapErrorRef.current = onMapError;
  }, [onMapError]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapNodeRef.current) return;
      try {
        await loadGooglePlacesScript();
        if (!window.google?.maps?.importLibrary) {
          throw new Error('Google Maps JavaScript API unavailable');
        }

        const [{ Map }] = await Promise.all([
          window.google.maps.importLibrary('maps')
        ]);
        let markerLibrary = null;
        try {
          markerLibrary = await window.google.maps.importLibrary('marker');
        } catch {
          markerLibrary = null;
        }

        if (cancelled) return;

        const center = toCenter(latitude, longitude);
        if (!mapRef.current) {
          mapRef.current = new Map(mapNodeRef.current, {
            center,
            zoom: hasCoordinates ? 16 : 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: 'greedy',
            zoomControl: true
          });
        } else {
          mapRef.current.setCenter(center);
          if (hasCoordinates && mapRef.current.getZoom() < 15) {
            mapRef.current.setZoom(16);
          }
        }

        const syncDrag = async (event) => {
          const latLng = event?.latLng || markerRef.current?.position;
          const nextLat = typeof latLng?.lat === 'function' ? latLng.lat() : latLng?.lat;
          const nextLng = typeof latLng?.lng === 'function' ? latLng.lng() : latLng?.lng;
          const resolvedLat = Number(nextLat);
          const resolvedLng = Number(nextLng);
          if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) return;
          onLocationChangeRef.current?.(resolvedLat, resolvedLng);
        };

        if (!markerRef.current) {
          const canUseAdvancedMarker = Boolean(markerLibrary?.AdvancedMarkerElement);
          if (canUseAdvancedMarker) {
            try {
              markerRef.current = new markerLibrary.AdvancedMarkerElement({
                map: mapRef.current,
                position: center,
                gmpDraggable: true,
                title: markerTitle
              });
            } catch {
              markerRef.current = null;
            }
          }

          if (!markerRef.current) {
            markerRef.current = new window.google.maps.Marker({
              map: mapRef.current,
              position: center,
              draggable: true,
              title: markerTitle
            });
          }

          if (dragListenerRef.current?.remove) {
            dragListenerRef.current.remove();
          }

          if (typeof markerRef.current.addListener === 'function') {
            dragListenerRef.current = markerRef.current.addListener('dragend', syncDrag);
          } else if (typeof markerRef.current.addEventListener === 'function') {
            markerRef.current.addEventListener('gmp-dragend', syncDrag);
          }
        }

        if (markerRef.current) {
          if ('position' in markerRef.current) {
            markerRef.current.position = center;
          } else if (typeof markerRef.current.setPosition === 'function') {
            markerRef.current.setPosition(center);
          }
          if ('map' in markerRef.current) {
            markerRef.current.map = mapRef.current;
          } else if (typeof markerRef.current.setMap === 'function') {
            markerRef.current.setMap(mapRef.current);
          }
        }

        setReadyState('ready');
      } catch (error) {
        if (!cancelled) {
          console.error('MapPicker failed to initialize:', error);
          setReadyState('error');
          onMapErrorRef.current?.(error);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (dragListenerRef.current?.remove) {
        dragListenerRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const center = toCenter(latitude, longitude);
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

    mapRef.current.setCenter(center);
    if (hasCoordinates && typeof mapRef.current.setZoom === 'function' && mapRef.current.getZoom() < 15) {
      mapRef.current.setZoom(16);
    }

    if ('position' in markerRef.current) {
      markerRef.current.position = center;
    } else if (typeof markerRef.current.setPosition === 'function') {
      markerRef.current.setPosition(center);
    }
  }, [hasCoordinates, latitude, longitude]);

  return (
    <div style={{ marginTop: '8px' }}>
      <div
        style={{
          border: '1px solid rgba(159, 23, 77, 0.16)',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#f8fafc',
          boxShadow: 'var(--shadow-soft)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 10px', borderBottom: '1px solid rgba(148, 163, 184, 0.22)', background: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#334155', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <MapPin size={13} />
            Map Preview
          </div>
          {mapsLink ? (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)', textDecoration: 'none' }}
            >
              <ExternalLink size={12} />
              Open in Google Maps
            </a>
          ) : (
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Open in Google Maps</span>
          )}
        </div>

        <div style={{ position: 'relative', height, minHeight: height, background: '#e2e8f0' }}>
          <div ref={mapNodeRef} style={{ width: '100%', height: '100%' }} />
          {readyState !== 'ready' ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '12px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(248,250,252,0.96), rgba(241,245,249,0.92))', color: '#475569', fontSize: '12px', fontWeight: 700, lineHeight: 1.45 }}>
              {readyState === 'loading'
                ? 'Loading Google Map preview...'
                : unavailableMessage}
            </div>
          ) : null}
        </div>
        <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(148, 163, 184, 0.18)', background: '#fff', fontSize: '11px', fontWeight: 700, color: '#475569', lineHeight: 1.35 }}>
          <span style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '6px' }}>Coords</span>
          {coordinateText}
        </div>
      </div>
    </div>
  );
}
