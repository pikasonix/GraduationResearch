import { useState, useCallback } from 'react';
import { Instance, Solution, Route, Node } from '../utils/dataModels';

export function useFileReader() {
    const [instance, setInstance] = useState(null);
    const [solution, setSolution] = useState(null);

    const tokenAndValue = useCallback((str) => {
        str = str.replace(/\t/g, "").trim();
        let els = str.split(":", 2);
        if (els.length === 1) return [els[0].trim()];
        return [els[0].trim(), els[1].trim()];
    }, []);

    const nodeReader = useCallback((elements, index, currentInstance) => {
        currentInstance.nodes = [];
        currentInstance.all_coords = [];

        for (let i = 0; i < currentInstance.size; i++) {
            let line = elements[index + i];
            let values = line.split(" ");
            let node = new Node(
                parseInt(values[0]),
                [parseFloat(values[1]), parseFloat(values[2])],
                parseInt(values[3]),
                [parseInt(values[4]), parseInt(values[5])],
                parseInt(values[6]),
                parseInt(values[7]),
                parseInt(values[8])
            );

            currentInstance.all_coords.push(node.coords);
            currentInstance.nodes.push(node);
        }
        return index + currentInstance.size - 1;
    }, []);

    const edgeReader = useCallback((elements, index, currentInstance) => {
        currentInstance.times = [];
        for (let i = 0; i < currentInstance.size; i++) {
            let line = elements[index + i];
            let values = line.split(" ");
            let times_i = [];
            for (const vstr of values) {
                times_i.push(parseInt(vstr, 10));
            }
            currentInstance.times.push(times_i);
        }
        return index + currentInstance.size - 1;
    }, []);

    const setRouteColors = useCallback((currentSolution) => {
        console.log("Setting route colors");
        const vec_colors = ["#3775b2", "#b1b945", "#45b940", "#953fbb", "#64d65f", "#396ced", "#7e54d4", "#529d21", "#da68e2", "#8dc74e"];
        let c = 0;
        while (c < currentSolution.routes.length) {
            currentSolution.routes[c].set_color(vec_colors[c % vec_colors.length]);
            c += 1;
        }
    }, []);

    const routeReader = useCallback((elements, index, currentInstance) => {
        console.log("Route reader called, starting at line", index);
        let routes = [];
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
            console.log("Route number part:", routeNumPart);
            console.log("Sequence part:", sequencePart);

            let routeNumMatch = routeNumPart.match(/Route\s+(\d+)/);
            if (!routeNumMatch) {
                console.log("Couldn't extract route number, skipping");
                continue;
            }

            let routeNum = parseInt(routeNumMatch[1]);
            console.log("Extracted route number:", routeNum);

            let sequence = sequencePart.split(/\s+/).filter(s => s.length > 0);
            console.log("Sequence nodes:", sequence);

            let route = new Route(r);
            let c = 0;

            if (!currentInstance || !currentInstance.nodes || !currentInstance.nodes[0]) {
                console.error("Instance or nodes not properly initialized");
                console.log("Instance:", currentInstance);
                if (currentInstance && currentInstance.nodes) {
                    console.log("Nodes length:", currentInstance.nodes.length);
                }
                continue;
            }

            route.push(0, currentInstance.nodes[0].coords);
            let bn = 0;

            try {
                for (const sn of sequence) {
                    if (sn.length === 0) continue;
                    let n = parseInt(sn);
                    console.log(`Processing node ${n}, previous node ${bn}`);

                    if (n < 0 || n >= currentInstance.nodes.length) {
                        console.error(`Node ${n} out of range (0-${currentInstance.nodes.length - 1})`);
                        continue;
                    }

                    if (!currentInstance.times || !currentInstance.times[bn]) {
                        console.error(`Times array not properly initialized for node ${bn}`);
                        console.log("Times array:", currentInstance.times);
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

    const instanceParser = useCallback((fileContent) => {
        const newInstance = new Instance();
        const elements = fileContent.split('\n');
        let l = 0;
        while (l < elements.length) {
            let line = elements[l];
            const tv = tokenAndValue(line);
            const token = tv[0].trim();

            if (token === "NAME") {
                newInstance.name = tv[1].replace(/\s+/g, "");
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
                alert("ERROR: Unknown keyword '" + token + "' token in instance file.\nAre you sure you are trying to load a valid instance file?");
                throw new Error("Unknown token in instance file: " + token);
            }
            l++;
        }
        setInstance(newInstance);
        return newInstance;
    }, [tokenAndValue, nodeReader, edgeReader]);

    const solutionParser = useCallback((fileContent, currentInstance) => {
        console.log("Solution parser called");
        let elements = fileContent.split('\n');
        console.log("Number of lines in solution file:", elements.length);
        let routes = [];
        let name = "";
        let reference = "";
        let date = "";
        let author = "";

        for (var l = 0; l < elements.length; l++) {
            let line = elements[l];
            console.log("Processing line:", line);

            const tv = tokenAndValue(line);
            console.log("Token and value:", tv);

            let token = tv[0].trim();

            if (token === "Instance name") {
                name = tv[1].replace(/\s+/g, "");
                console.log("Found instance name:", name);
            } else if (token === "Authors") {
                author = tv[1];
                console.log("Found author:", author);
            } else if (token === "Date") {
                date = tv[1];
                console.log("Found date:", date);
            } else if (token === "Reference") {
                reference = tv[1];
                console.log("Found reference:", reference);
            } else if (token === "Solution") {
                console.log("Found Solution section, starting route parser");
                routes = routeReader(elements, l + 1, currentInstance);
                console.log("Routes parsed:", routes.length);
                l = elements.length;
            } else {
                console.error("Unknown token:", token);
                alert("ERROR: Unknown keyword '" + token + "' token in solution file.\nAre you sure the solution file is properly formatted?");
                throw new Error("Unknown token in solution file: " + token);
            }
        }

        if (routes.length === 0) {
            console.error("No routes were parsed!");
            throw new Error("No routes were parsed from solution file.");
        }

        console.log("Creating Solution object");
        const newSolution = new Solution(name, reference, date, author, routes);
        console.log("Setting route colors");
        setRouteColors(newSolution);
        setSolution(newSolution);
        return newSolution;
    }, [tokenAndValue, routeReader, setRouteColors]);

    const readInstanceFile = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsedInstance = instanceParser(e.target.result);
                    resolve(parsedInstance);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }, [instanceParser]);

    const readSolutionFile = useCallback((file, currentInstance) => {
        return new Promise((resolve, reject) => {
            if (!currentInstance) {
                reject(new Error("Instance data is required to parse solution."));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsedSolution = solutionParser(e.target.result, currentInstance);
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