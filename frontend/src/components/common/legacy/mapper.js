import config from '../../../config/config';

var reader = new Reader();
var instance = null;
var solution = null;

// Global variables
let map = null;
let polygons = new Map();
let routes_polylines = new Map(); // Store polylines for routes
let use_real_routing = false; // Toggle for real routing
let routing_cache = new Map(); // Cache for routing results
let cache_enabled = true; // Enable/disable cache

// Cache management
function generateCacheKey(startCoord, endCoord) {
    return `${startCoord[0].toFixed(6)},${startCoord[1].toFixed(6)}-${endCoord[0].toFixed(6)},${endCoord[1].toFixed(6)}`;
}

function loadCacheFromStorage() {
    try {
        const cached = localStorage.getItem('pdptw_routing_cache');
        if (cached) {
            const data = JSON.parse(cached);
            routing_cache = new Map(data);
            console.log(`Loaded ${routing_cache.size} cached routes from storage`);
        }
    } catch (error) {
        console.warn('Error loading cache from storage:', error);
        routing_cache = new Map();
    }
}

function saveCacheToStorage() {
    try {
        const data = Array.from(routing_cache.entries());
        localStorage.setItem('pdptw_routing_cache', JSON.stringify(data));
        console.log(`Saved ${routing_cache.size} routes to cache`);
    } catch (error) {
        console.warn('Error saving cache to storage:', error);
    }
}

/**
 * Show cache information to user
 */
function showCacheInfo() {
    const stats = getCacheStats();
    const cacheSize = (JSON.stringify(Object.fromEntries(routing_cache)).length / 1024).toFixed(2);

    const info = `
Thng tin Cache:
 S tuyn 1f u: ${stats.total}
 Hits: ${stats.hits}
 Misses: ${stats.misses} 
 Hit rate: ${stats.total > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) : 0}%
 Kch th c cache: ${cacheSize} KB
 Cache trong localStorage: ${localStorage.getItem('pdptw_routing_cache') ? 'C' : 'Khng'}
    `.trim();

    alert(info);
}

function clearRoutingCache() {
    routing_cache.clear();
    localStorage.removeItem('pdptw_routing_cache');
    console.log('Routing cache cleared');
}

function getCacheStats() {
    const cacheSize = routing_cache.size;
    let storageSize = 0;
    try {
        const cached = localStorage.getItem('pdptw_routing_cache');
        storageSize = cached ? (cached.length * 2) / 1024 : 0; // Approximate size in KB
    } catch (error) {
        // Ignore errors
    }
    return { entries: cacheSize, sizeKB: storageSize.toFixed(1) };
}

let markers = [];
let selected_nodes = null;
let selected_route = null;
let is_solution_loaded = false;
let routes_filled = true;
let routes_showing = true;
let markers_showing = true;

let show_markers_btn, show_routes_btn, fill_routes_btn, adjust_pos_btn;


var highlight_route_filled_style = {
    'highlight': {
        'color': 'red',
        'fillOpacity': 0.5
    }
};

var highlight_route_hollow_style = {
    'highlight': {
        'color': 'red',
        'fillOpacity': 0
    }
};

function fade_routes(is_fading, except_id) {
    if (is_fading) {
        for (const [key, p] of polygons) {
            if (key === except_id) continue;

            if (use_real_routing) {
                // For polylines
                p.setStyle({ opacity: 0.3, weight: 2 });
            } else {
                // For polygons
                let fill = routes_filled ? 0.08 : 0;
                p.setStyle({ fillOpacity: fill, opacity: 0.3 });
            }
        }
    } else {
        for (const [key, p] of polygons) {
            if (use_real_routing) {
                // Reset polylines
                p.setStyle({ opacity: 0.8, weight: 4 });
            } else {
                // Reset polygons
                let fill = routes_filled ? 0.2 : 0;
                p.setStyle({ fillOpacity: fill, opacity: 1 });
            }
        }
    }
}

function highlight_route(route, light_on) {
    console.log('highlight_route called:', { route: route.id, light_on, use_real_routing });

    if (light_on) {
        const routeLayer = polygons.get(route.id);
        if (routeLayer) {
            if (use_real_routing) {
                // For polylines, change color and weight
                routeLayer.setStyle({
                    color: 'red',
                    weight: 6,
                    opacity: 1
                }).bringToFront();
                console.log('Highlighted polyline for route:', route.id);
            } else {
                // For polygons, use existing logic
                let style = routes_filled ? highlight_route_filled_style : highlight_route_hollow_style;
                routeLayer.setStyle(style.highlight).bringToFront();
                console.log('Highlighted polygon for route:', route.id);
            }
        } else {
            console.warn('Route layer not found for route:', route.id);
        }
        fade_routes(true, route.id);
    } else {
        const routeLayer = polygons.get(route.id);
        if (routeLayer) {
            if (use_real_routing) {
                // Reset polyline style
                routeLayer.setStyle({
                    color: route.color,
                    weight: 4,
                    opacity: 0.8
                });
                console.log('Reset polyline style for route:', route.id);
            } else {
                // Reset polygon style
                routeLayer.setStyle({ 'color': route.color });
                console.log('Reset polygon style for route:', route.id);
            }
        } else {
            console.warn('Route layer not found for route:', route.id);
        }
        fade_routes(false, undefined);
    }
}

function clear_route_selection(event) {
    console.log('clear_route_selection called, current selected_route:', selected_route?.id);

    if (selected_route != null) {
        const routeLayer = polygons.get(selected_route.id);
        if (routeLayer) {
            if (use_real_routing) {
                // Reset polyline style
                routeLayer.setStyle({
                    color: selected_route.color,
                    weight: 4,
                    opacity: 0.8
                });
            } else {
                // Reset polygon style
                routeLayer.setStyle({ 'color': selected_route.color });
            }
        }
        color_side_bar_btn(event, selected_route.side_bar_btn)
        selected_route = null;
        console.log('Route selection cleared');
    }
    fade_routes(false, undefined);
}



function on_click_route(event, route, closing = false) {
    console.log('on_click_route called:', { route: route.id, closing, selected_route: selected_route?.id });

    if (closing) {
        if (selected_route !== null && selected_route.id !== route.id)
            return
        else {
            clear_route_selection(event)
            return
        }
    }

    clear_route_selection(event)
    highlight_route(route, true)
    color_side_bar_btn(event, route.side_bar_btn)

    selected_route = route;
    console.log('Route selected:', route.id);
}



function clear_node_selection(event) {
    if (selected_nodes != null) {
        highlight_markers(selected_nodes[0], false)
        color_side_bar_btn(event, selected_nodes[0].side_bar_btn)
        if (selected_nodes.length > 1) color_side_bar_btn(event, selected_nodes[1].side_bar_btn)
        selected_nodes = null
    }
}

function color_side_bar_btn(event, item) {
    if (!item) {
        console.error("color_side_bar_btn: item is null");
        return;
    }
    if (!item.style) {
        console.error("color_side_bar_btn: item.style is null for item:", item);
        return;
    }

    const highlightColor = '#0d0c0c';
    const highlightBgColor = '#cec2c2';

    if (item.style.color === highlightColor) { // If it's currently highlighted
        item.style.color = '';
        item.style.backgroundColor = '';
    } else { // If it's not highlighted
        item.style.color = highlightColor;
        item.style.backgroundColor = highlightBgColor;
    }
}

function on_click_node(event, node) {
    if (selected_nodes !== null) {
        if ((node.is_depot || node.is_pickup) && selected_nodes[0].id === node.id) {
            clear_node_selection(event)
            return
        } else if (node.is_delivery && selected_nodes[1].id === node.id) {
            clear_node_selection(event)
            return
        }
    }
    clear_node_selection(event)

    highlight_markers(node, true)

    selected_nodes = [node]
    if (!node.is_depot) {
        selected_nodes.push(instance.nodes[node.pair])
        if (selected_nodes[0].is_delivery) {
            let t = selected_nodes[0]
            selected_nodes[0] = selected_nodes[1]
            selected_nodes[1] = t
        }
    }
    color_side_bar_btn(event, selected_nodes[0].side_bar_btn)
    if (selected_nodes.length > 1) color_side_bar_btn(event, selected_nodes[1].side_bar_btn)
}


var clear_selections = function (e) {
    clear_node_selection(e)
    clear_route_selection(e)
}

geographic_map(); //by default: tool starts showing the world map

function enable_button(btn, active) {
    if (!btn) {
        console.error("enable_button: btn is null");
        return;
    }
    btn.disabled = !active
    if (!btn.button) {
        console.error("enable_button: btn.button is null for btn:", btn);
        return;
    }
    if (btn.disabled) {
        btn.button.style.backgroundColor = '#dcdcdc';
        btn.button.style.color = '#858383';
    } else {
        btn.button.style.backgroundColor = 'white';
        btn.button.style.color = 'black';
    }
}

function select_button(btn, selected) {
    if (!btn) {
        console.error("select_button: btn is null");
        return;
    }
    if (!btn.button) {
        console.error("select_button: btn.button is null for btn:", btn);
        return;
    }
    if (selected) {
        btn.button.style.backgroundColor = '#b0aaaa';
    } else {
        btn.button.style.backgroundColor = 'white';
    }
}

function common_map_setup() {
    map.zoomControl.setPosition("topright") //set the zoom icons somewhere else
    map.on('click', clear_selections);

    adjust_pos_btn = L.easyButton('fa fa-crosshairs', function (btn, map) {
        if (btn.disabled) return;
        if (btn && btn.button) {
            btn.button.style.backgroundColor = 'white';
        } else {
            console.error("adjust_pos_btn callback: btn.button is null");
        }
        adjust_zoom();
    }, "Adjust zoom");
    adjust_pos_btn.options.position = "topright";
    adjust_pos_btn.addTo(map);
    enable_button(adjust_pos_btn, false)

    show_markers_btn = L.easyButton('fas fa-map-marker-alt', function (btn, map) {
        if (btn.disabled) return;
        // Note: backgroundColor is set in toggle_markers, not directly here after click.
        toggle_markers();
    }, "Toggle locations");
    enable_button(show_markers_btn, false)

    show_routes_btn = L.easyButton('fa fa-draw-polygon', function (btn, map) {
        if (btn.disabled) return;
        // Note: backgroundColor is set in toggle_routes, not directly here after click.
        toggle_routes();
    }, "Toggle routes");
    enable_button(show_routes_btn, false)

    fill_routes_btn = L.easyButton('fa fa-fill-drip', function (btn, map) {
        if (btn.disabled) return;
        // Note: backgroundColor is set in fill_routes, not directly here after click.
        fill_routes();
    }, "Fill routes");
    enable_button(fill_routes_btn, false)

    var edit_bar = L.easyBar([
        show_markers_btn,
        show_routes_btn,
        fill_routes_btn
    ]);

    edit_bar.options.position = "topright";
    edit_bar.addTo(map);
}

function geographic_map() {
    if (map != null) {
        map.off();
        map.remove();
    }

    map = L.map('map'); //{preferCanvas: true}. To try, might improve performance
    map.setView([0, 0], 2.5);

    L.tileLayer(config.map.tileUrl, {
        maxZoom: 19,
        minZoom: 2.5,
        attribution: config.map.attribution
    }).addTo(map);

    common_map_setup();
}

function toggle_markers() {
    if (markers_showing) { //hide all markers
        for (const m of markers) {
            map.removeLayer(m);
        }
    }
}