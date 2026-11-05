import React, { Suspense } from 'react';
import type { ShiftGoogleMapViewProps } from './ShiftGoogleMapView';

const loadShiftGoogleMapView = () => import('./ShiftGoogleMapView');

export function preloadShiftGoogleMapView() {
  void loadShiftGoogleMapView();
}

const ShiftGoogleMapView = React.lazy(() =>
  loadShiftGoogleMapView().then((module) => ({ default: module.ShiftGoogleMapView }))
);

export const LazyShiftGoogleMapView: React.FC<ShiftGoogleMapViewProps> = (props) => (
  <Suspense
    fallback={
      <div className="p-6 text-sm text-slate-400">Loading map...</div>
    }
  >
    <ShiftGoogleMapView {...props} />
  </Suspense>
);
