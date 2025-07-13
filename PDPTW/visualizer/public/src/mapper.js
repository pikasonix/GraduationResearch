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
Thông tin Cache:
• Số tuyến đường đã lưu: ${stats.total}
• Hits: ${stats.hits}
• Misses: ${stats.misses} 
• Hit rate: ${stats.total > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) : 0}%
• Kích thước cache: ${cacheSize} KB
• Cache trong localStorage: ${localStorage.getItem('pdptw_routing_cache') ? 'Có' : 'Không'}
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
            } else {
                // For polygons, use existing logic
                let style = routes_filled ? highlight_route_filled_style : highlight_route_hollow_style;
                routeLayer.setStyle(style.highlight).bringToFront();
            }
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
            } else {
                // Reset polygon style
                routeLayer.setStyle({ 'color': route.color });
            }
        }
        fade_routes(false, undefined);
    }
}

function clear_route_selection(event) {
    if (selected_route != null) {
        polygons.get(selected_route.id).setStyle({ 'color': selected_route.color });
        color_side_bar_btn(event, selected_route.side_bar_btn)
        selected_route = null;
    }
    fade_routes(false, undefined);
}


function on_click_route(event, route, closing = false) {
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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 2.5,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    common_map_setup();
}

function toggle_markers() {
    if (markers_showing) { //hide all markers
        for (const m of markers) {
            map.removeLayer(m);
        }
        markers_showing = false;
        if (show_markers_btn && show_markers_btn.button) {
            show_markers_btn.button.style.backgroundColor = 'white';
        } else {
            console.error("toggle_markers (hiding): show_markers_btn.button is null");
        }
    } else { //show all markers
        if (instance !== null) {
            for (let node of instance.nodes) {
                node.marker.addTo(map)
            }
        }
        markers_showing = true;
        if (show_markers_btn && show_markers_btn.button) {
            show_markers_btn.button.style.backgroundColor = '#b0aaaa';
        } else {
            console.error("toggle_markers (showing): show_markers_btn.button is null");
        }
    }
}

function toggle_routes() {
    if (!is_solution_loaded) return;
    if (routes_showing) {
        for (const m of polygons.values()) {
            map.removeLayer(m);
        }
        routes_showing = false;
        if (show_routes_btn && show_routes_btn.button) {
            show_routes_btn.button.style.backgroundColor = 'white';
        } else {
            console.error("toggle_routes (hiding): show_routes_btn.button is null");
        }
    } else {
        for (const m of polygons.values()) {
            m.bringToFront().addTo(map);
        }
        routes_showing = true;
        if (show_routes_btn && show_routes_btn.button) {
            show_routes_btn.button.style.backgroundColor = '#948e8e';
        } else {
            console.error("toggle_routes (showing): show_routes_btn.button is null");
        }
    }
}

function fill_routes() {
    if (!is_solution_loaded) return;
    if (!routes_filled) {
        for (const p of polygons.values()) {
            p.setStyle({ fillOpacity: 0.2 })
        }
        routes_filled = true;
        if (fill_routes_btn && fill_routes_btn.button) {
            fill_routes_btn.button.style.backgroundColor = '#948e8e';
        } else {
            console.error("fill_routes (filling): fill_routes_btn.button is null");
        }
    } else {
        for (const p of polygons.values()) {
            p.setStyle({ fillOpacity: 0 })
        }
        routes_filled = false;
        if (fill_routes_btn && fill_routes_btn.button) {
            fill_routes_btn.button.style.backgroundColor = 'white';
        } else {
            console.error("fill_routes (unfilling): fill_routes_btn.button is null");
        }
    }
}


function adjust_zoom() {
    let bounds = new L.LatLngBounds(instance.all_coords)
    map.fitBounds(bounds.pad(0.5))
}


function list_nodes_in_menu() {
    document.getElementById("nodes_dropdown").innerHTML = "";
    var container = document.getElementById('nodes_dropdown');

    for (let node of instance.nodes) {
        var a = document.createElement('a');
        a.href = '#';
        a.className = "node-item";

        // Thêm icon cho từng loại node với class riêng
        let iconHtml = '';
        if (node.is_depot) {
            iconHtml = '<i class="fa fa-circle depot-icon"></i>';
        } else if (node.is_pickup) {
            iconHtml = '<i class="fa fa-circle pickup-icon"></i>';
        } else if (node.is_delivery) {
            iconHtml = '<i class="fa-regular fa-circle delivery-icon"></i>';
        }

        a.innerHTML = iconHtml + node.string_name();

        a.onclick = function (e) {
            e.preventDefault();

            // Xóa class selected từ tất cả các node items khác
            const allNodeItems = container.querySelectorAll('.node-item');
            allNodeItems.forEach(item => item.classList.remove('selected'));

            // Thêm class selected cho item hiện tại
            a.classList.add('selected');

            // Tự động highlight khi click
            highlight_markers(node, true);
            // Sau đó gọi function click gốc
            on_click_node(e, node);

            // Tự động scroll đến node trên bản đồ và zoom in một chút
            if (node.marker && map) {
                const currentZoom = map.getZoom();
                const targetZoom = Math.max(currentZoom, 15);
                map.setView(node.coords, targetZoom, {
                    animate: true,
                    duration: 0.8
                });
            }
        };

        a.onmouseover = function (e) {
            if (selected_nodes == null) {
                highlight_markers(node, true);
            }
        }

        a.onmouseout = function (e) {
            if (selected_nodes == null) {
                highlight_markers(node, false);
            }
        }

        container.appendChild(a);
        node.side_bar_btn = a;
    }
}

function list_routes_in_menu() {
    document.getElementById("routes_dropdown").innerHTML = "";
    var container = document.getElementById('routes_dropdown');

    for (let route of solution.routes) {
        let route_btn = document.createElement('button');
        let route_container = document.createElement('div');

        route_btn.className = "dropdown-btn"
        route_container.style.height = "fit-content"
        route_container.style.paddingLeft = "12px"
        route_container.style.overflow = "hidden"

        route_btn.innerText = 'Route ' + String(route.id + 1) + " (Cost: " + String(route.cost) + ")"
        route_btn.style.width = "98%"

        for (let n of route.sequence) {
            let a = document.createElement('a');
            a.href = '#';
            if (instance.nodes[n].is_depot) {
                a.innerHTML = "<i class=\"fa fa-circle fa-2xs\"></i> " + instance.nodes[n].string_name()
            } else {
                a.innerHTML = "<i class=\"fa-regular fa-circle fa-2xs\"></i> " + instance.nodes[n].string_name()
            }
            a.className = "changeable";
            a.style.width = "80%"

            let node = instance.nodes[n]

            a.onclick = function (e) {
                on_click_node(e, node)
            };

            a.onmouseover = function (e) {
                if (selected_nodes == null)
                    highlight_markers(node, true)
            }

            a.onmouseout = function (e) {
                if (selected_nodes == null)
                    highlight_markers(node, false)
            }


            route_container.appendChild(a)
        }

        route_container.style.display = "none"

        route_btn.onclick = function (e) {
            let closing = false;
            if (route_container.style.display === "none") {
                route_container.style.display = "block"
            } else {
                route_container.style.display = "none"
                closing = true
            }

            on_click_route(e, route, closing); // Corrected 'event' to 'e'
        };

        route_btn.onmouseover = function (e) {
            if (selected_route == null)
                highlight_route(route, true)
        }

        route_btn.onmouseout = function (e) {
            if (selected_route == null)
                highlight_route(route, false)
        }

        route.side_bar_btn = route_btn;


        container.appendChild(route_btn)
        container.appendChild(route_container)
    }
}

function reset_visualizer() {
    reset_nodes_list()
    reset_routes_list()

    //clean up map area
    for (const p of polygons.values()) {
        map.removeLayer(p);
    }
    for (const m of markers) {
        map.removeLayer(m);
    }

    solution = {} //clean up the solution
    instance = {}
    markers = []
    is_solution_loaded = false;

    enable_instance_buttons(false)
    enable_solution_buttons(false)
    deactivate_load_solution_button()
}


async function draw_solution(solution) {
    console.log('draw_solution called with:', solution);
    console.log('use_real_routing:', use_real_routing);
    
    for (var route of solution.routes) {
        console.log('Processing route:', route.id, 'sequence:', route.sequence);
        
        const tooltipText = `<b>Route ${route.id}</b><br>Cost: ${route.cost}<br>Nodes: ${route.sequence.length}<br>${use_real_routing ? 'Real routing' : 'Straight lines'}`;
        
        if (use_real_routing) {
            console.log('Building real route for route', route.id);
            
            // Build real route using routing API
            const routeCoords = await buildRealRoute(route);
            console.log('Real route coords for route', route.id, ':', routeCoords.length, 'points');
            
            // Create polyline instead of polygon for real routes
            let polyline = L.polyline(routeCoords, { 
                color: route.color, 
                weight: 4,
                opacity: 0.8
            });
            
            // Add tooltip
            polyline.bindTooltip(tooltipText);
            
            // Add click events to polyline
            polyline.on('click', function(e) {
                on_click_route(e, route, false);
            });
            
            polyline.on('mouseover', function(e) {
                if (selected_route == null) {
                    highlight_route(route, true);
                }
            });
            
            polyline.on('mouseout', function(e) {
                if (selected_route == null) {
                    highlight_route(route, false);
                }
            });
            
            polyline.addTo(map);
            routes_polylines.set(route.id, polyline);
            
            // Also store in polygons map for compatibility with existing code
            polygons.set(route.id, polyline);
            
            console.log('Added polyline for route', route.id, 'to map');
        } else {
            console.log('Creating polygon for route', route.id);
            
            // Original polygon method
            let p = route.path;
            console.log('Route path:', p);
            
            let poly = L.polygon(p, { color: route.color });
            
            // Add tooltip
            poly.bindTooltip(tooltipText);
            
            // Add click events to polygon
            poly.on('click', function(e) {
                on_click_route(e, route, false);
            });
            
            poly.on('mouseover', function(e) {
                if (selected_route == null) {
                    highlight_route(route, true);
                }
            });
            
            poly.on('mouseout', function(e) {
                if (selected_route == null) {
                    highlight_route(route, false);
                }
            });
            
            poly.addTo(map);
            polygons.set(route.id, poly);
            
            console.log('Added polygon for route', route.id, 'to map');
        }
    }
    
    console.log('draw_solution completed. Total routes processed:', solution.routes.length);
}

function enable_solution_buttons(active) {
    enable_button(show_routes_btn, active)
    enable_button(fill_routes_btn, active)
}

function read_solution_file(input) {

    var after_loading_solution = function () {
        solution = reader.solution
        is_solution_loaded = true;
        routes_showing = true;
        routes_filled = true;

        enable_solution_buttons(true)
        select_button(show_routes_btn, true)
        select_button(fill_routes_btn, true)
        draw_solution(solution)
        activate_routes_list()
        list_routes_in_menu()

        // Show and populate route analysis section
        if (typeof showRouteAnalysisSection === 'function') {
            showRouteAnalysisSection();
        }
        if (typeof populateRouteAnalysis === 'function') {
            populateRouteAnalysis();
        }
    }

    reader.read_solution(input.files[0], after_loading_solution);
}


function create_node_icon(node, iconSize, isOpaque = false) {
    let icon;
    let leafletIconSize;
    let iconAnchor;
    let classNameValue; // Renamed to avoid conflict with the 'className' property of L.divIcon options

    // Debug logging
    console.log(`Creating icon for node ${node.id}:`, {
        is_pickup: node.is_pickup,
        is_delivery: node.is_delivery,
        is_depot: node.is_depot,
        iconSize: iconSize,
        isOpaque: isOpaque,
        coords: node.coords
    });

    if (node.is_pickup) {
        classNameValue = isOpaque ? 'pickup-marker-opaque' : 'pickup-marker';
        // Pickup markers are text-based. Using the passed iconSize.
        leafletIconSize = [iconSize, iconSize];
        iconAnchor = [leafletIconSize[0] / 2, leafletIconSize[1] / 2];
        console.log(`Pickup node ${node.id}: className=${classNameValue}, size=[${leafletIconSize}], anchor=[${iconAnchor}]`);
    } else if (node.is_delivery) {
        classNameValue = isOpaque ? 'delivery-marker-opaque' : 'delivery-marker';
        // Use dynamic iconSize like pickup markers
        leafletIconSize = [iconSize, iconSize];
        // Anchor square bottom center at location
        iconAnchor = [leafletIconSize[0] / 2, leafletIconSize[1]];
        console.log(`Delivery node ${node.id}: className=${classNameValue}, size=[${leafletIconSize}], anchor=[${iconAnchor}]`);
    } else { // Depot
        classNameValue = isOpaque ? 'depot-marker-opaque' : 'depot-marker';
        // Force size to match CSS .depot-marker (w-4 h-4 => 16px)
        leafletIconSize = [16, 16];
        iconAnchor = [8, 8];
        console.log(`Depot node ${node.id}: className=${classNameValue}, size=[${leafletIconSize}], anchor=[${iconAnchor}]`);
    }

    icon = L.divIcon({
        className: classNameValue,
        iconAnchor: iconAnchor,
        iconSize: leafletIconSize
    });

    console.log(`Created L.divIcon for node ${node.id}:`, icon);
    return icon;
}

function highlight_markers(node, light_on) {
    var marker = node.marker

    if (light_on) {
        marker.setIcon(marker.large_icon)
        marker.setZIndexOffset(1000)
    } else {
        marker.setIcon(marker.small_icon)
        marker.setZIndexOffset(0)
    }

    if (!node.is_depot) {
        var pair = instance.nodes[node.pair]
        if (light_on) {
            pair.marker.setIcon(pair.marker.large_icon)
            pair.marker.setZIndexOffset(1000)
        } else {
            pair.marker.setIcon(pair.marker.small_icon)
            pair.marker.setZIndexOffset(0)
        }
    }

    for (var other of instance.nodes) {
        if (other.id === node.id || other.id === node.pair) {
            continue
        }

        if (light_on) other.marker.setIcon(other.marker.opaque_icon)
        else other.marker.setIcon(other.marker.small_icon)
    }

}

function add_node_to_map(node) {

    let small_icon = create_node_icon(node, 10, false)
    let large_icon = create_node_icon(node, 20, false)
    let opaque_icon = create_node_icon(node, 10, true)

    var marker = L.marker(node.coords, {
        icon: small_icon
    });

    node.marker = marker

    marker.small_icon = small_icon
    marker.large_icon = large_icon
    marker.opaque_icon = opaque_icon

    marker.on('mouseover', function (e) {
        if (selected_nodes == null)
            highlight_markers(node, true)
    })

    marker.on('mouseout', function (e) {
        if (selected_nodes == null)
            highlight_markers(node, false)
    })

    marker.on('click', function (e) {
        on_click_node(e, node)
    })

    str_type = "Depot"
    if (node.is_pickup) {
        str_type = "Pickup"
    } else if (node.is_delivery) {
        str_type = "Delivery"
    }

    node.marker.addTo(map).bindTooltip("<b>" + str_type + ": " + String(node.id) + "</b><br>&ensp;Demand: " + String(node.demand) + "<br>&ensp;Time window: [ " + String(node.time_window[0]) + " , " + String(node.time_window[1]) + " ]")
    markers.push(node.marker)
}


function enable_instance_buttons(active) {
    enable_button(adjust_pos_btn, active)
    enable_button(show_markers_btn, active)
}


function read_instance_file(input, callback) {
    reset_visualizer();
    reader = new Reader();

    var after_loading_instance = function () {
        instance = reader.instance
        markers_showing = true;

        for (var node of instance.nodes) {
            add_node_to_map(node)
        }

        enable_instance_buttons(true)
        select_button(show_markers_btn, true)

        adjust_zoom()

        activate_load_solution_button();
        activate_nodes_list()

        list_nodes_in_menu()

        // Auto-fill textarea with instance content
        const fileReader = new FileReader();
        fileReader.onload = function (e) {
            const instanceTextarea = document.getElementById('instance_textarea');
            if (instanceTextarea) {
                instanceTextarea.value = e.target.result;
            }
        };
        fileReader.readAsText(input.files[0]);

    };

    reader.read_instance(input.files[0], function () {
        after_loading_instance();
        if (typeof callback === 'function') callback();
    });
}

// Real routing functionality
async function getRouteFromAPI(startCoord, endCoord) {
    // Generate cache key
    const cacheKey = generateCacheKey(startCoord, endCoord);
    
    // Check cache first
    if (cache_enabled && routing_cache.has(cacheKey)) {
        console.log(`Cache hit for ${cacheKey}`);
        return routing_cache.get(cacheKey);
    }
    
    try {
        // Using OSRM Demo API - for production use your own instance
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson`;
        
        console.log(`Fetching route from API: ${cacheKey}`);
        const response = await fetch(url);
        const data = await response.json();
        
        let routeCoords;
        if (data.routes && data.routes.length > 0) {
            // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
            routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } else {
            console.warn('No route found, using straight line');
            routeCoords = [startCoord, endCoord];
        }
        
        // Cache the result
        if (cache_enabled) {
            routing_cache.set(cacheKey, routeCoords);
            // Save to localStorage every 10 new entries
            if (routing_cache.size % 10 === 0) {
                saveCacheToStorage();
            }
        }
        
        return routeCoords;
    } catch (error) {
        console.warn('Routing API error:', error, 'Using straight line');
        const fallback = [startCoord, endCoord];
        
        // Cache the fallback too to avoid repeated failed API calls
        if (cache_enabled) {
            routing_cache.set(cacheKey, fallback);
        }
        
        return fallback;
    }
}

async function buildRealRoute(route) {
    console.log('buildRealRoute called for route:', route.id);
    console.log('Route sequence:', route.sequence);
    
    const routeCoords = [];
    const sequence = route.sequence;
    
    if (!sequence || sequence.length < 2) {
        console.warn('Invalid route sequence for route', route.id);
        return route.path; // Fallback to original path
    }
    
    const cacheStats = getCacheStats();
    console.log(`Cache stats: ${cacheStats.entries} entries, ${cacheStats.sizeKB} KB`);
    
    for (let i = 0; i < sequence.length - 1; i++) {
        const currentNodeId = sequence[i];
        const nextNodeId = sequence[i + 1];
        
        console.log(`Processing segment ${i}: ${currentNodeId} -> ${nextNodeId}`);
        
        // Get coordinates from instance nodes
        const startCoord = instance.nodes[currentNodeId].coords;
        const endCoord = instance.nodes[nextNodeId].coords;
        
        if (use_real_routing) {
            const segmentCoords = await getRouteFromAPI(startCoord, endCoord);
            console.log(`Segment ${i}: Got ${segmentCoords.length} coordinates`);
            
            // Add all coordinates except the last one (to avoid duplication)
            if (i === 0) {
                routeCoords.push(...segmentCoords);
            } else {
                routeCoords.push(...segmentCoords.slice(1));
            }
        } else {
            // Use straight line
            if (i === 0) {
                routeCoords.push(startCoord, endCoord);
            } else {
                routeCoords.push(endCoord);
            }
        }
        
        // Add small delay to avoid overwhelming the API (only for non-cached requests)
        if (use_real_routing && i < sequence.length - 2) {
            const cacheKey = generateCacheKey(startCoord, endCoord);
            if (!routing_cache.has(cacheKey)) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }
    
    console.log(`buildRealRoute completed for route ${route.id}. Total coordinates:`, routeCoords.length);
    
    return routeCoords.length > 0 ? routeCoords : route.path;
}

function toggleRealRouting() {
    console.log('toggleRealRouting called. Current use_real_routing:', use_real_routing);
    
    use_real_routing = !use_real_routing;
    
    console.log('New use_real_routing:', use_real_routing);
    
    // Update button text and style
    const button = document.getElementById('toggle_routing_btn');
    if (button) {
        const icon = button.querySelector('i');
        const text = button.querySelector('span');
        
        console.log('Button found, updating UI');
        
        if (use_real_routing) {
            text.textContent = 'Tắt đường thực tế';
            button.style.backgroundColor = '#10b981';
            button.style.borderColor = '#10b981';
            icon.className = 'fas fa-route';
        } else {
            text.textContent = 'Bật đường thực tế';
            button.style.backgroundColor = '#6b7280';
            button.style.borderColor = '#6b7280';
            icon.className = 'fas fa-map-marked-alt';
        }
    } else {
        console.error('Button not found!');
    }
    
    // Redraw routes if solution is loaded
    console.log('Checking if solution is loaded:', is_solution_loaded, solution);
    
    if (is_solution_loaded && solution) {
        console.log('Redrawing routes with new mode');
        redrawRoutesWithNewMode();
    } else {
        console.log('No solution loaded, skipping redraw');
    }
}

async function redrawRoutesWithNewMode() {
    // Save cache before clearing routes
    if (use_real_routing && routing_cache.size > 0) {
        saveCacheToStorage();
    }
    
    // Clear existing routes
    for (const p of polygons.values()) {
        map.removeLayer(p);
    }
    for (const p of routes_polylines.values()) {
        map.removeLayer(p);
    }
    
    polygons.clear();
    routes_polylines.clear();
    
    // Show loading indicator with cache info
    const cacheStats = getCacheStats();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'routing_loading';
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000;">
            <div style="text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 10px;"></i>
                <p style="margin: 0; font-weight: 500;">
                    ${use_real_routing ? 'Đang tải đường đi thực tế...' : 'Đang chuyển về đường thẳng...'}
                </p>
                ${use_real_routing ? `
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                        Cache: ${cacheStats.entries} routes (${cacheStats.sizeKB} KB)
                    </p>
                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #999;">
                        Các route đã cache sẽ load nhanh hơn
                    </p>
                ` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        await draw_solution(solution);
        
        // Save cache after successful completion
        if (use_real_routing) {
            saveCacheToStorage();
        }
    } catch (error) {
        console.error('Error redrawing routes:', error);
        alert('Có lỗi khi tải đường đi. Vui lòng thử lại.');
    } finally {
        // Remove loading indicator
        const loading = document.getElementById('routing_loading');
        if (loading) {
            loading.remove();
        }
    }
}