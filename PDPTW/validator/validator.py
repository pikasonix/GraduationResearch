import math
import os

class Node:
    def __init__(self):
        self.idx = 0  # node index
        self.etw = 0  # time window [etw, ltw]
        self.ltw = 0
        self.dur = 0  # service duration
        self.dem = 0  # node demand
        self.pair = 0  # node pair

class Instance:
    def __init__(self):
        self.size = 0  # number of nodes
        self.capacity = 0  # vehicle capacity
        self.nodes = list()
        self.times = list()

    def read_from_file(self, filename):    
        with open(filename, "r") as f:
            # Read HEADER section (basic information)
            for _ in range(20):
                line = f.readline()
                fields = line.split(" ")

                if len(fields) == 1 and fields[0][:-1] == "NODES":
                    break
                elif fields[0][:-1] == "SIZE":
                    self.size = int(fields[1][:-1])
                elif fields[0][:-1] == "CAPACITY":
                    self.capacity = int(fields[1][:-1])

            # Read NODES section
            for _ in range(self.size):
                line = f.readline()
                fields = line.split(" ")

                node = Node()
                node.idx = int(fields[0])
                node.dem = int(fields[3])
                node.etw = int(fields[4])
                node.ltw = int(fields[5])
                node.dur = int(fields[6])

                if node.dem > 0:
                    node.pair = node.idx + int(math.floor(self.size / 2))
                elif node.dem < 0:
                    node.pair = node.idx - int(math.floor(self.size / 2))

                self.nodes.append(node)

            # Read EDGES section
            f.readline()  # skip "EDGES"
            for _ in range(self.size):
                line = f.readline()
                fields = line.split(" ")
                self.times.append([int(x) for x in fields])

class Solution:
    def __init__(self):
        self.inst_name = ""
        self.cost = 0
        self.routes = list()

    def read_from_file(self, filename):
        with open(filename, "r", errors='ignore') as f:
            self.cost = 0
            self.routes = list()

            for _ in range(5):
                line = f.readline()
                # print(f"DEBUG: Header line: {line.strip()}") 
                cl = line.split(" : ")
                if cl[0] == "Instance name":
                    self.inst_name = cl[1].strip()

            route_counter = 0
            for line in f:
                if ":" not in line:
                    continue
                route_counter += 1
                parts = line.split(":")
                if len(parts) < 2:
                    continue
                sequence_part = parts[1].strip()
                sequence = sequence_part.split()
                sequence = list(filter(bool, sequence))
                self.routes.append([0])  # Start from depot
                try:
                    nodes = [int(n) for n in sequence]
                    self.routes[-1].extend(nodes)
                except ValueError as e:
                    print(f"DEBUG: Error converting to integers: {e}")
                self.routes[-1].append(0)  # Return to depot

def validate_solution(inst, sol):
    visited = [0 for _ in range(inst.size)]
    result = True
    cost = 0
    message = "Valid"

    print(f"DEBUG: Validating solution with {len(sol.routes)} routes")
    print(f"DEBUG: Instance size: {inst.size}")
    
    for r_idx, r in enumerate(sol.routes):
        print(f"DEBUG: Validating route {r_idx+1}: {r}")
        time = 0
        load = 0
        n = 0

        for a in r[1:]:
            # print(f"DEBUG: Processing node {a}")
            if a != 0 and visited[a] == 1:
                message = f"Node {a} visited twice"
                print(f"DEBUG: {message}")
                result = False
                break

            time += inst.times[n][a]
            time = max(time, inst.nodes[a].etw)
            if time > inst.nodes[a].ltw:
                message = f"Visit after time window limit at {a}: {time} > {inst.nodes[a].ltw}"
                print(f"DEBUG: {message}")
                result = False
                break

            if inst.nodes[a].dem < 0 and visited[inst.nodes[a].pair] == 0:
                message = f"Delivery before pickup for pair ({inst.nodes[a].pair},{a})"
                print(f"DEBUG: {message}")
                result = False
                break

            load += inst.nodes[a].dem
            if load > inst.capacity:
                message = f"Vehicle overloaded at {a}: {load} > {inst.capacity}"
                print(f"DEBUG: {message}")
                result = False
                break

            time += inst.nodes[a].dur
            cost += inst.times[n][a]
            n = a
            visited[a] = 1
            # print(f"DEBUG: Node {a} marked as visited") 

        if not result:
            break

    visited_count = sum(visited)
    print(f"DEBUG: Total nodes visited: {visited_count} out of {inst.size}")
    
    if visited_count < inst.size:
        missing = [a for a in range(1, len(inst.nodes)) if visited[a] == 0]
        message = f"Nodes were not visited ({inst.size - visited_count} out of {inst.size}): {missing}"
        print(f"DEBUG: {message}")
        result = False

    return [result, message, len(sol.routes), cost]

def validate(inst_path, sol_path):
    print(f"DEBUG: instance: {inst_path}, solution: {sol_path}")
    inst = Instance()
    inst.read_from_file(inst_path)
    print(f"DEBUG: Instance Size: {inst.size}, Capacity: {inst.capacity}")
    
    sol = Solution()
    sol.read_from_file(sol_path)
    print(f"DEBUG: Solution with {len(sol.routes)} routes")
    
    return validate_solution(inst, sol)

if __name__ == '__main__':
    parent_dir = os.path.dirname(os.path.dirname(__file__))
    inst_path = os.path.join(parent_dir, "input.txt")
    sol_path = os.path.join(parent_dir, "output.txt")

    try:
        [valid, msg, numv, cost] = validate(inst_path, sol_path)
        if valid:
            print(f"Vehicles: {numv}  ,  Cost: {cost}")
        else:
            print(f"Error: {msg}")
        print("VALID" if valid else "INVALID")
    except FileNotFoundError as e:
        print(f"File not found: {e.filename}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")