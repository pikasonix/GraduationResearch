export interface Instance {
    all_coords: [number, number][];
    nodes: Node[];
    times: number[][];
    name: string;
    type: string;
    size: number;
    capacity: number;
    location: string;
}

export interface Solution {
    instance_name: string;
    reference: string;
    date: string;
    author: string;
    routes: Route[];
}

export interface Route {
    id: number;
    sequence: number[];
    path: [number, number][];
    color: string;
    cost: number;
    push(n: number, coord: [number, number]): void;
    set_color(new_color: string): void;
}

export interface Node {
    id: number;
    coords: [number, number];
    demand: number;
    time_window: [number, number];
    duration: number;
    is_depot: boolean;
    is_pickup: boolean;
    is_delivery: boolean;
    pair: number;
}

export function createInstance(): Instance {
    return {
        all_coords: [],
        nodes: [],
        times: [],
        name: "",
        type: "",
        size: 0,
        capacity: 0,
        location: ""
    };
}

export function createSolution(instance_name: string, reference: string, date: string, author: string, routes: Route[]): Solution {
    return {
        instance_name,
        reference,
        date,
        author,
        routes
    };
}

export function createRoute(id: number): Route {
    return {
        id,
        sequence: [],
        path: [],
        color: "#000000",
        cost: 0,
        push(n: number, coord: [number, number]) {
            this.sequence.push(n);
            this.path.push(coord);
        },
        set_color(new_color: string) {
            this.color = new_color;
        }
    };
}

export function createNode(id: number, coords: [number, number], demand: number, time_window: [number, number], duration: number, is_pickup: boolean, is_delivery: boolean): Node {
    return {
        id,
        coords,
        demand,
        time_window,
        duration,
        is_depot: id === 0,
        is_pickup,
        is_delivery,
        pair: -1
    };
}
