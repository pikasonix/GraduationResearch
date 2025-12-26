/**
 * SVG to React Component Converter
 * Automatically scans components folder and standardizes all icon components
 * Preserves gradients and styling
 * 
 * Usage:
 * 1. Put your .tsx files with raw SVG in: icon/components/pin/, icon/components/weather/, etc.
 * 2. Run: npm run icons:generate
 * 
 * Structure:
 * icon/
 *   ├── raw/               ← Raw SVG files (moved from /map)
 *   ├── components/        ← Icon components (standardized)
 *   │   ├── pin/
 *   │   ├── weather/
 *   │   └── vehicle/
 *   ├── index.ts           ← Auto-generated exports
 *   └── preview.tsx        ← Auto-generated preview
 */

import * as fs from 'fs';
import * as path from 'path';

interface ConvertOptions {
  componentName: string;
  inputSvg: string;
  fileName: string;
  category: string;
}

function cleanSvgAttributes(svgString: string): string {
  return svgString
    // Remove unnecessary attributes
    .replace(/\s+version="[^"]*"/g, '')
    .replace(/\s+x="[^"]*"/g, '')
    .replace(/\s+y="[^"]*"/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s+xml:space="[^"]*"/g, '')
    .replace(/\s+data-original="[^"]*"/g, '')
    .replace(/\s+opacity="1"/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    // Convert attributes to camelCase for React
    .replace(/stop-color=/g, 'stopColor=')
    .replace(/stop-opacity=/g, 'stopOpacity=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/fill-opacity=/g, 'fillOpacity=')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSvgContent(svgString: string): {
  viewBox: string;
  content: string;
} {
  const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';

  // Extract content between <svg> tags
  const contentMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const rawContent = contentMatch ? contentMatch[1] : svgString;

  // Clean the content
  const content = rawContent
    .replace(/<g>/g, '')
    .replace(/<\/g>/g, '')
    .trim();

  return { viewBox, content };
}

function generateComponent(options: ConvertOptions): string {
  const { componentName, inputSvg } = options;

  // Clean SVG
  const cleanedSvg = cleanSvgAttributes(inputSvg);
  const { viewBox, content } = extractSvgContent(cleanedSvg);

  // Generate component code
  const componentCode = `interface ${componentName}Props {
  width?: number;
  height?: number;
  className?: string;
}

export default function ${componentName}({
  width = 20,
  height = 20,
  className = "",
}: ${componentName}Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="${viewBox}"
      className={className}
    >
      ${content}
    </svg>
  );
}
`;

  return componentCode;
}

// ============================================
// SCAN AND STANDARDIZE COMPONENTS
// ============================================

function isStandardComponent(content: string): boolean {
  // Check if component has standard structure
  const hasInterface = /interface\s+\w+Props\s*{/.test(content);
  const hasExportDefault = /export\s+default\s+function/.test(content);
  const hasProps = /width\?\s*:\s*number/.test(content) && /height\?\s*:\s*number/.test(content);

  return hasInterface && hasExportDefault && hasProps;
}

function extractSvgFromComponent(content: string): string | null {
  // Extract SVG content from TSX file
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/);
  return svgMatch ? svgMatch[0] : null;
}

function scanComponentFiles(): ConvertOptions[] {
  const componentsPath = path.join(__dirname, 'components');
  const configs: ConvertOptions[] = [];

  if (!fs.existsSync(componentsPath)) {
    console.log('⚠️  components folder not found.');
    return [];
  }

  // Read all category folders
  const categories = fs.readdirSync(componentsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  if (categories.length === 0) {
    console.log('⚠️  No category folders found in components/');
    return [];
  }

  // Scan each category folder
  categories.forEach(category => {
    const categoryPath = path.join(componentsPath, category);
    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.tsx'));

    files.forEach(file => {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const fileName = path.parse(file).name;
      const componentName = fileName + 'Icon';

      // Check if component is already standardized
      if (isStandardComponent(content)) {
        console.log(`✅ Already standard: ${category}/${fileName}`);
        return; // Skip this file
      }

      // Extract SVG from non-standard component
      const inputSvg = extractSvgFromComponent(content);

      if (!inputSvg) {
        console.log(`⚠️  No SVG found in: ${category}/${fileName}`);
        return;
      }

      configs.push({
        componentName,
        category,
        fileName,
        inputSvg,
      });

      console.log(`🔄 Need to standardize: ${category}/${fileName} -> ${componentName}`);
    });
  });

  return configs;
}

function createComponentFiles(options: ConvertOptions) {
  const { componentName, inputSvg, fileName, category } = options;

  // Generate component code
  const componentCode = generateComponent({ componentName, inputSvg, fileName, category });

  // Create category folder if not exists
  const categoryPath = path.join(__dirname, 'components', category);
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
  }

  // Write component file
  const componentFilePath = path.join(categoryPath, `${fileName}.tsx`);
  fs.writeFileSync(componentFilePath, componentCode, 'utf-8');

  console.log(`✅ Standardized: ${componentFilePath}`);
}

// ============================================
// SCAN ALL EXISTING COMPONENTS
// ============================================

function scanAllComponents(): { category: string; componentName: string; fileName: string }[] {
  const components: { category: string; componentName: string; fileName: string }[] = [];
  const componentsPath = path.join(__dirname, 'components');

  if (!fs.existsSync(componentsPath)) {
    return [];
  }

  const categories = fs.readdirSync(componentsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  categories.forEach(category => {
    const categoryPath = path.join(componentsPath, category);

    if (!fs.existsSync(categoryPath)) {
      return;
    }

    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.tsx'));

    files.forEach(file => {
      const fileName = path.parse(file).name;
      const componentName = fileName + 'Icon';

      components.push({
        category,
        componentName,
        fileName,
      });
    });
  });

  return components;
}

function updateCentralIndex(components: { category: string; componentName: string; fileName: string }[]) {
  const indexPath = path.join(__dirname, 'index.ts');

  // Group by category
  const byCategory: Record<string, typeof components> = {};
  components.forEach(config => {
    if (!byCategory[config.category]) {
      byCategory[config.category] = [];
    }
    byCategory[config.category].push(config);
  });


  // Generate index content
  let indexContent = '// Auto-generated by svg-to-component.ts\n';
  indexContent += '// Do not edit manually\n\n';

  Object.keys(byCategory).sort().forEach(category => {
    indexContent += `// ${category.charAt(0).toUpperCase() + category.slice(1)} Icons\n`;
    byCategory[category].forEach(config => {
      indexContent += `export { default as ${config.componentName} } from './components/${category}/${config.fileName}';\n`;
    });
    indexContent += '\n';
  });

  fs.writeFileSync(indexPath, indexContent, 'utf-8');
  console.log(`✅ Updated: ${indexPath}`);
}

function updatePreview(components: { category: string; componentName: string; fileName: string }[]) {
  const previewPath = path.join(__dirname, 'preview.tsx');

  // Generate imports
  const imports = components.map(c => c.componentName).join(', ');

  // Generate icon displays
  let iconDisplays = '';
  components.forEach(c => {
    iconDisplays += `          <div className="text-center">
            <${c.componentName} />
            <p className="text-xs mt-2">${c.componentName}</p>
          </div>
`;
  });

  const firstIconName = components[0]?.componentName || 'null';

  const previewContent = `"use client";

import { ${imports} } from './index';

/**
 * Icon Preview Component
 * Auto-generated - shows all available icons
 */

export default function IconPreview() {
  const IconComponent = ${firstIconName};

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Icon Preview ({${components.length}} icons)</h1>

      {/* All icons */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">All Icons</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
${iconDisplays}        </div>
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
          <p>{"import { ${components.slice(0, 3).map(c => c.componentName).join(', ')} } from '@/components/icon';"}</p>
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
`;

  fs.writeFileSync(previewPath, previewContent, 'utf-8');
  console.log(`✅ Updated: ${previewPath}`);
}

const componentsToStandardize = scanComponentFiles();
const allComponents = scanAllComponents();

if (allComponents.length === 0) {
  console.log('\n❌ No components found in components/ folder.');
  console.log('\n💡 To use this tool:');
  console.log('   1. Create: src/components/icon/components/pin/');
  console.log('   2. Put your .tsx files with SVG there');
  console.log('   3. Run: npm run icons:generate');
  process.exit(0);
}

// ============================================
// RUN CONVERTER
// ============================================

console.log('🚀 Starting icon management...\n');

// Standardize non-standard components
if (componentsToStandardize.length > 0) {
  console.log(`\n🔄 Standardizing ${componentsToStandardize.length} components...\n`);
  componentsToStandardize.forEach(config => {
    createComponentFiles(config);
  });
} else {
  console.log('✅ All components are already standardized!');
}

// Update central index with all components
console.log(`\n📝 Updating index.ts with ${allComponents.length} components...`);
updateCentralIndex(allComponents);

// Update preview
console.log(`📝 Updating preview.tsx...`);
updatePreview(allComponents);

console.log('\n🎉 Done!');
console.log(`\n📊 Summary:`);
console.log(`   - Total components: ${allComponents.length}`);
console.log(`   - Standardized: ${componentsToStandardize.length}`);
console.log(`\n📝 Usage:`);
console.log(`   import { ${allComponents.slice(0, 3).map(c => c.componentName).join(', ')} } from '@/components/icon';`);
