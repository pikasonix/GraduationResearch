import { useState, useCallback } from 'react';
// Import the correct types from dataModels
import { Instance, Solution, Route, Node } from '@/utils/dataModels';

export function useFileReader() {
    const [instance, setInstance] = useState<Instance | null>(null);
    const [solution, setSolution] = useState<Solution | null>(null);

    const tokenAndValue = useCallback((str: string): string[] => {
        // normalize tabs and any newline characters, trim
        str = (str || '').replace(/\t/g, "").replace(/[\r\n]+/g, " ").trim();
        let els = str.split(":", 2);
        if (els.length === 1) return [els[0].trim()];
        // Also sanitize the value to remove stray newlines/spurious tokens
        return [els[0].trim(), els[1].trim().replace(/[\r\n]+/g, ' ').trim()];
    }, []);

    const nodeReader = useCallback((elements: string[], index: number, currentInstance: Instance): number => {
        currentInstance.nodes = [];
        currentInstance.all_coords = [];

        for (let i = 0; i < currentInstance.size; i++) {
            let line = (elements[index + i] || '').trim();
            let values = line.split(/\s+/);

            // Parse basic fields with safe fallbacks
            const id = parseInt(values[0], 10);
            const lat = parseFloat(values[1]);
            const lon = parseFloat(values[2]);
            const demand = parseInt(values[3], 10);
            const etw = parseInt(values[4], 10);
            const ltw = parseInt(values[5], 10);
            const duration = parseInt(values[6], 10);

            // p = pickup pair (non-zero when this node is a delivery)
            // d = delivery pair (non-zero when this node is a pickup)
            const p = values[7] ? parseInt(values[7], 10) : 0;
            const d = values[8] ? parseInt(values[8], 10) : 0;

            // Determine types: depot if id === 0; otherwise use p/d fields
            let is_depot = id === 0;
            let is_delivery = p > 0; // delivery nodes reference their pickup in p
            let is_pickup = d > 0; // pickup nodes reference their delivery in d

            // Fallback: if p/d are missing or zero, infer from demand sign
            if (!is_pickup && !is_delivery && !is_depot) {
                if (!Number.isNaN(demand)) {
                    if (demand > 0) is_pickup = true;
                    else if (demand < 0) is_delivery = true;
                }
            }

            const pair = is_pickup ? d : (is_delivery ? p : -1);

            // Create node object
            let node: Node = {
                id: id,
                coords: [lat, lon],
                demand: demand,
                time_window: [etw, ltw],
                duration: duration,
                is_depot: is_depot,
                is_pickup: is_pickup,
                is_delivery: is_delivery,
                pair: pair
            };

            currentInstance.all_coords.push(node.coords);
            currentInstance.nodes.push(node);
        }
        // Debug: log first 6 nodes to verify parsing of types/pairs
        console.log('nodeReader: parsed nodes (first 6):', currentInstance.nodes.slice(0, 6).map(n => ({ id: n.id, is_depot: n.is_depot, is_pickup: n.is_pickup, is_delivery: n.is_delivery, pair: n.pair })));
        return index + currentInstance.size - 1;
    }, []);

    const edgeReader = useCallback((elements: string[], index: number, currentInstance: Instance): number => {
        currentInstance.times = [];
        for (let i = 0; i < currentInstance.size; i++) {
            let line = (elements[index + i] || '').trim();
            let values = line.split(/\s+/);
            let times_i: number[] = [];
            for (const vstr of values) {
                times_i.push(parseInt(vstr, 10));
            }
            currentInstance.times.push(times_i);
        }
        return index + currentInstance.size - 1;
    }, []);

    const setRouteColors = useCallback((currentSolution: Solution) => {
        console.log("Setting route colors");
        const vec_colors = ["#3775b2", "#b1b945", "#45b940", "#953fbb", "#64d65f", "#396ced", "#7e54d4", "#529d21", "#da68e2", "#8dc74e"];
        let c = 0;
        while (c < currentSolution.routes.length) {
            currentSolution.routes[c].set_color(vec_colors[c % vec_colors.length]);
            c += 1;
        }
    }, []);

    const routeReader = useCallback((elements: string[], index: number, currentInstance: Instance): Route[] => {
        console.log("Route reader called, starting at line", index);
        let routes: Route[] = [];
        let r = 0;
        for (let i = index; i < elements.length; i++) {
            let line = elements[i].trim();
            console.log("Processing route line:", line);

            if (line.length === 0) {
                console.log("Empty line, breaking");
                break;
            }

            if (!line.startsWith("Route")) {
                console.log("Line doesn't start with 'Route', skipping");
                continue;
            }

            let parts = line.split(":");
            console.log("Split line into parts:", parts);

            if (parts.length !== 2) {
                console.log("Line doesn't have exactly one colon, skipping");
                continue;
            }

            let routeNumPart = parts[0].trim();
            let sequencePart = parts[1].trim();

            let routeNumMatch = routeNumPart.match(/Route\s+(\d+)/);
            if (!routeNumMatch) {
                console.log("Couldn't extract route number, skipping");
                continue;
            }

            let routeNum = parseInt(routeNumMatch[1]);
            console.log("Extracted route number:", routeNum);

            let sequence = sequencePart.split(/\s+/).filter(s => s.length > 0);
            console.log("Sequence nodes:", sequence);

            // Create route object directly
            let route: Route = {
                id: r,
                cost: 0,
                sequence: [],
                path: [],
                color: "#000000",
                push: function (nodeId: number, coords: [number, number]) {
                    this.sequence.push(nodeId);
                    this.path.push(coords);
                },
                set_color: function (color: string) {
                    this.color = color;
                }
            };

            let c = 0;

            if (!currentInstance || !currentInstance.nodes || !currentInstance.nodes[0]) {
                console.error("Instance or nodes not properly initialized");
                continue;
            }

            route.push(0, currentInstance.nodes[0].coords);
            let bn = 0;

            try {
                for (const sn of sequence) {
                    if (sn.length === 0) continue;
                    let n = parseInt(sn);

                    if (n < 0 || n >= currentInstance.nodes.length) {
                        console.error(`Node ${n} out of range (0-${currentInstance.nodes.length - 1})`);
                        continue;
                    }

                    if (!currentInstance.times || !currentInstance.times[bn]) {
                        console.error(`Times array not properly initialized for node ${bn}`);
                        continue;
                    }

                    c += currentInstance.times[bn][n];
                    bn = n;
                    route.push(n, currentInstance.nodes[n].coords);
                }

                c += currentInstance.times[bn][0];
                route.push(0, currentInstance.nodes[0].coords);
                route.cost = c;

                routes.push(route);
                r += 1;
                console.log(`Added route ${r} with cost ${c}`);
            } catch (e) {
                console.error("Error while processing route:", e);
            }
        }

        console.log("Returning", routes.length, "routes");
        return routes;
    }, []);

    const instanceParser = useCallback((fileContent: string): Instance => {
        // Create instance object directly
        const newInstance: Instance = {
            name: '',
            location: '',
            type: '',
            size: 0,
            capacity: 0,
            nodes: [],
            all_coords: [],
            times: []
        };

        // split on both LF and CRLF, normalize lines
        const elements = fileContent.split(/\r?\n/);
        console.log('instanceParser: first 12 lines:', elements.slice(0, 12));
        let l = 0;
        while (l < elements.length) {
            let line = elements[l];
            console.log('instanceParser: processing line', l, JSON.stringify(line));
            const tv = tokenAndValue(line);
            const token = tv[0].trim();

            if (token === "NAME") {
                newInstance.name = tv[1].replace(/\\s+/g, "");
            } else if (token === "LOCATION") {
                newInstance.location = tv[1];
            } else if (token === "TYPE") {
                newInstance.type = tv[1];
            } else if (token === "SIZE") {
                newInstance.size = parseInt(tv[1]);
            } else if (token === "CAPACITY") {
                newInstance.capacity = parseInt(tv[1]);
            } else if (
                token === "COMMENT" ||
                token === "DISTRIBUTION" ||
                token === "DEPOT" ||
                token === "ROUTE-TIME" ||
                token === "TIME-WINDOW"
            ) {
                // ignore
            } else if (token === "NODES") {
                l = nodeReader(elements, l + 1, newInstance);
            } else if (token === "EDGES") {
                l = edgeReader(elements, l + 1, newInstance);
            } else if (token === "EOF") {
                break;
            } else {
                console.error("ERROR: Unknown keyword '" + token + "' token in instance file.");
                throw new Error("Unknown token in instance file: " + token);
            }
            l++;
        }
        setInstance(newInstance);
        console.log('useFileReader: instance set', { name: newInstance.name, size: newInstance.size, nodes: newInstance.nodes?.length, all_coords: newInstance.all_coords?.length });
        return newInstance;
    }, [tokenAndValue, nodeReader, edgeReader]);

    const solutionParser = useCallback((fileContent: string, currentInstance: Instance): Solution => {
        console.log("Solution parser called");
        // split on real newlines (handle CRLF and LF)
        let elements = fileContent.split(/\r?\n/);
        let routes: Route[] = [];
        let name = "";
        let reference = "";
        let date = "";
        let author = "";

        for (var l = 0; l < elements.length; l++) {
            let line = elements[l];
            const tv = tokenAndValue(line);
            let token = tv[0].trim();

            // allow flexible token matching (trim and case-insensitive)
            const tLower = token.toLowerCase();
            if (tLower === "instance name" || tLower === "instance name :" || tLower === "instance") {
                name = tv[1].replace(/\\s+/g, "");
            } else if (token === "Authors") {
                author = tv[1];
            } else if (token === "Date") {
                date = tv[1];
            } else if (token === "Reference") {
                reference = tv[1];
            } else if (tLower === "solution") {
                routes = routeReader(elements, l + 1, currentInstance);
                l = elements.length;
            } else {
                console.error("Unknown token:", token);
                throw new Error("Unknown token in solution file: " + token);
            }
        }

        if (routes.length === 0) {
            throw new Error("No routes were parsed from solution file.");
        }

        const newSolution: Solution = {
            instance_name: name,
            reference,
            date,
            author,
            routes
        };

        setRouteColors(newSolution);
        setSolution(newSolution);
        return newSolution;
    }, [tokenAndValue, routeReader, setRouteColors]);

    const readInstanceFile = useCallback((file: File): Promise<Instance> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = e.target?.result as string;
                    const parsedInstance = instanceParser(result);
                    resolve(parsedInstance);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }, [instanceParser]);

    const readSolutionFile = useCallback((file: File, currentInstance?: Instance): Promise<Solution> => {
        return new Promise((resolve, reject) => {
            if (!currentInstance) {
                reject(new Error("Instance data is required to parse solution."));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = e.target?.result as string;
                    const parsedSolution = solutionParser(result, currentInstance);
                    resolve(parsedSolution);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }, [solutionParser]);

    return { instance, solution, readInstanceFile, readSolutionFile, setInstance, setSolution };
}
