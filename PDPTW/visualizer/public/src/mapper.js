var reader = new Reader();
var instance = null;
var solution = null;

// Global variables
let map = null;
let polygons = new Map();

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
        let fill = routes_filled ? 0.08 : 0;
        for (const [key, p] of polygons) {
            if (key === except_id) continue;
            p.setStyle({ fillOpacity: fill, opacity: 0.3 })
        }
    } else {
        let fill = routes_filled ? 0.2 : 0;
        for (const p of polygons.values()) {
            p.setStyle({ fillOpacity: fill, opacity: 1 })
        }
    }
}

function highlight_route(route, light_on) {
    if (light_on) {
        let style = routes_filled ? highlight_route_filled_style : highlight_route_hollow_style
        polygons.get(route.id).setStyle(style.highlight).bringToFront();
        fade_routes(true, route.id);
    } else {
        polygons.get(route.id).setStyle({ 'color': route.color });
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


function draw_solution(solution) {

    for (var route of solution.routes) {
        let p = route.path;
        let s = route.sequence;

        let poly = L.polygon(p, { color: route.color });
        poly.addTo(map);

        polygons.set(route.id, poly);
    }
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