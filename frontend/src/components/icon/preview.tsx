"use client";

import { AddPinIcon, HomePinIcon, MarkPinIcon, NavigationPinIcon, PinIcon, BigTruckIcon, MiniTruckIcon, MotobikeIcon, SunnyIcon } from './index';

/**
 * Icon Preview Component
 * Auto-generated - shows all available icons
 */

export default function IconPreview() {
  const IconComponent = AddPinIcon;

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Icon Preview ({9} icons)</h1>

      {/* All icons */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">All Icons</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
          <div className="text-center">
            <AddPinIcon />
            <p className="text-xs mt-2">AddPinIcon</p>
          </div>
          <div className="text-center">
            <HomePinIcon />
            <p className="text-xs mt-2">HomePinIcon</p>
          </div>
          <div className="text-center">
            <MarkPinIcon />
            <p className="text-xs mt-2">MarkPinIcon</p>
          </div>
          <div className="text-center">
            <NavigationPinIcon />
            <p className="text-xs mt-2">NavigationPinIcon</p>
          </div>
          <div className="text-center">
            <PinIcon />
            <p className="text-xs mt-2">PinIcon</p>
          </div>
          <div className="text-center">
            <BigTruckIcon />
            <p className="text-xs mt-2">BigTruckIcon</p>
          </div>
          <div className="text-center">
            <MiniTruckIcon />
            <p className="text-xs mt-2">MiniTruckIcon</p>
          </div>
          <div className="text-center">
            <MotobikeIcon />
            <p className="text-xs mt-2">MotobikeIcon</p>
          </div>
          <div className="text-center">
            <SunnyIcon />
            <p className="text-xs mt-2">SunnyIcon</p>
          </div>
        </div>
      </section>

      {/* Different sizes */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Different Sizes</h2>
        <div className="flex items-end gap-6 flex-wrap">
          <div className="text-center">
            <IconComponent width={24} height={24} />
            <p className="text-xs mt-2">24x24</p>
          </div>
          <div className="text-center">
            <IconComponent width={32} height={32} />
            <p className="text-xs mt-2">32x32</p>
          </div>
          <div className="text-center">
            <IconComponent width={48} height={48} />
            <p className="text-xs mt-2">48x48</p>
          </div>
          <div className="text-center">
            <IconComponent width={64} height={64} />
            <p className="text-xs mt-2">64x64</p>
          </div>
          <div className="text-center">
            <IconComponent width={96} height={96} />
            <p className="text-xs mt-2">96x96</p>
          </div>
        </div>
      </section>

      {/* On different backgrounds */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">On Different Backgrounds</h2>
        <div className="flex gap-6 flex-wrap">
          <div className="bg-white p-4 border rounded">
            <IconComponent />
            <p className="text-xs mt-2">White</p>
          </div>
          <div className="bg-gray-100 p-4 rounded">
            <IconComponent />
            <p className="text-xs mt-2">Gray</p>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <IconComponent />
            <p className="text-xs mt-2 text-white">Dark</p>
          </div>
          <div className="bg-blue-500 p-4 rounded">
            <IconComponent />
            <p className="text-xs mt-2 text-white">Blue</p>
          </div>
        </div>
      </section>

      {/* Usage */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Usage Examples</h2>
        <div className="space-y-2 text-sm font-mono bg-gray-900 text-gray-100 p-4 rounded">
          <p className="text-green-400">// Import icons</p>
          <p>{"import { AddPinIcon, HomePinIcon, MarkPinIcon } from '@/components/icon';"}</p>
          <br />
          <p className="text-green-400">// Use with default size</p>
          <p>{'<IconComponent />'}</p>
          <br />
          <p className="text-green-400">// Custom size</p>
          <p>{'<IconComponent width={32} height={32} />'}</p>
          <br />
          <p className="text-green-400">// With className</p>
          <p>{'<IconComponent className="text-blue-500 hover:scale-110" />'}</p>
        </div>
      </section>
    </div>
  );
}
