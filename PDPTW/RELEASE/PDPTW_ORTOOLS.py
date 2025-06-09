import re
from dataclasses import dataclass
from typing import List, Dict, Tuple
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

@dataclass
class Node:
    id: int
    lat: float
    lon: float
    demand: int
    early_time: int
    late_time: int
    service_duration: int
    pickup_pair: int
    delivery_pair: int
    
    def is_depot(self) -> bool:
        return self.id == 0
    
    def is_pickup(self) -> bool:
        return self.demand > 0
    
    def is_delivery(self) -> bool:
        return self.demand < 0

@dataclass
class Instance:
    name: str
    location: str
    size: int
    capacity: int
    route_time: int
    nodes: List[Node]
    travel_times: List[List[int]]

def parse_input(filename: str) -> Instance:
    """Parse input file và trả về Instance object"""
    with open(filename, 'r', encoding='utf-8') as file:
        lines = [line.strip() for line in file.readlines()]
    
    # Đọc thông tin header
    info = {}
    i = 0
    while i < len(lines) and lines[i] != "NODES":
        if ':' in lines[i]:
            key, value = lines[i].split(':', 1)
            info[key.strip()] = value.strip()
        i += 1
    
    # Đọc nodes
    i += 1  # Skip "NODES" line
    size = int(info.get("SIZE", 0))
    nodes = []
    
    for j in range(size):
        parts = lines[i + j].split()
        node = Node(
            id=int(parts[0]),
            lat=float(parts[1]),
            lon=float(parts[2]),
            demand=int(parts[3]),
            early_time=int(parts[4]),
            late_time=int(parts[5]),
            service_duration=int(parts[6]),
            pickup_pair=int(parts[7]),
            delivery_pair=int(parts[8])
        )
        nodes.append(node)
    
    i += size
    
    # Tìm "EDGES" line
    while i < len(lines) and lines[i] != "EDGES":
        i += 1
    i += 1  # Skip "EDGES" line
    
    # Đọc travel times matrix
    travel_times = []
    for j in range(size):
        row = [int(x) for x in lines[i + j].split()]
        travel_times.append(row)
    
    return Instance(
        name=info.get("NAME", ""),
        location=info.get("LOCATION", ""),
        size=size,
        capacity=int(info.get("CAPACITY", 0)),
        route_time=int(info.get("ROUTE-TIME", 0)),
        nodes=nodes,
        travel_times=travel_times
    )

class PDPTWSolver:
    def __init__(self, instance: Instance, num_vehicles: int):
        self.instance = instance
        self.num_vehicles = num_vehicles
        self.pickup_deliveries = []
        
        # Tạo danh sách pickup-delivery pairs
        for node in instance.nodes:
            if node.is_pickup():
                pickup_idx = node.id
                delivery_idx = node.delivery_pair
                self.pickup_deliveries.append((pickup_idx, delivery_idx))
    
    def create_data_model(self):
        """Tạo data model cho OR-Tools"""
        data = {}
        data['distance_matrix'] = self.instance.travel_times
        data['time_matrix'] = self.instance.travel_times  # Giả sử time = distance
        data['time_windows'] = [(node.early_time, node.late_time) for node in self.instance.nodes]
        data['service_times'] = [node.service_duration for node in self.instance.nodes]
        data['demands'] = [node.demand for node in self.instance.nodes]
        data['vehicle_capacities'] = [self.instance.capacity] * self.num_vehicles
        data['num_vehicles'] = self.num_vehicles
        data['depot'] = 0
        data['pickups_deliveries'] = self.pickup_deliveries
        
        return data
    
    def solve(self):
        """Giải bài toán PDPTW"""
        data = self.create_data_model()
        
        # Tạo routing model
        manager = pywrapcp.RoutingIndexManager(
            len(data['distance_matrix']), 
            data['num_vehicles'], 
            data['depot']
        )
        routing = pywrapcp.RoutingModel(manager)
        
        # Distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return data['distance_matrix'][from_node][to_node]
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Time dimension
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return data['time_matrix'][from_node][to_node] + data['service_times'][from_node]
        
        time_callback_index = routing.RegisterTransitCallback(time_callback)
        time = 'Time'
        routing.AddDimension(
            time_callback_index,
            30,  # allow waiting time
            self.instance.route_time,  # maximum time per vehicle
            False,  # Don't force start cumul to zero
            time
        )
        time_dimension = routing.GetDimensionOrDie(time)
        
        # Add time window constraints
        for location_idx, time_window in enumerate(data['time_windows']):
            if location_idx == data['depot']:
                continue
            index = manager.NodeToIndex(location_idx)
            time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
        
        # Add time window constraints for depot
        depot_idx = data['depot']
        for vehicle_id in range(data['num_vehicles']):
            index = routing.Start(vehicle_id)
            time_dimension.CumulVar(index).SetRange(
                data['time_windows'][depot_idx][0],
                data['time_windows'][depot_idx][1]
            )
            index = routing.End(vehicle_id)
            time_dimension.CumulVar(index).SetRange(
                data['time_windows'][depot_idx][0],
                data['time_windows'][depot_idx][1]
            )
        
        # Capacity constraint
        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return data['demands'][from_node]
        
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            data['vehicle_capacities'],  # vehicle maximum capacities
            True,  # start cumul to zero
            'Capacity'
        )
        
        # Pickup and delivery constraints
        for pickup_index, delivery_index in data['pickups_deliveries']:
            pickup_node = manager.NodeToIndex(pickup_index)
            delivery_node = manager.NodeToIndex(delivery_index)
            
            routing.AddPickupAndDelivery(pickup_node, delivery_node)
            routing.solver().Add(
                routing.VehicleVar(pickup_node) == routing.VehicleVar(delivery_node)
            )
            routing.solver().Add(
                time_dimension.CumulVar(pickup_node) <= time_dimension.CumulVar(delivery_node)
            )
        
        # Search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(30)
        
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            return self.get_solution(data, manager, routing, solution)
        else:
            return None
    
    def get_solution(self, data, manager, routing, solution):
        """Trích xuất solution từ OR-Tools"""
        routes = []
        total_distance = 0
        total_time = 0
        
        for vehicle_id in range(data['num_vehicles']):
            index = routing.Start(vehicle_id)
            route = []
            route_distance = 0
            route_time = 0
            
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                if node_index != 0:  # Skip depot
                    route.append(node_index)
                
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
            
            if route:  # Only add non-empty routes
                routes.append(route)
                total_distance += route_distance
        
        return {
            'routes': routes,
            'total_cost': total_distance,
            'objective': solution.ObjectiveValue()
        }

def write_output(filename: str, instance: Instance, solution: Dict):
    """Ghi kết quả ra file output"""
    with open(filename, 'w', encoding='utf-8') as file:
        file.write(f"Instance name : {instance.name}\n")
        file.write(f"Authors       : OR-Tools PDPTW Solver\n")
        file.write(f"Date          : 2025\n")
        file.write(f"Reference     : OR-Tools Constraint Programming\n")
        file.write(f"Solution\n")
        
        # Write routes
        for i, route in enumerate(solution['routes'], 1):
            if route:
                file.write(f"Route {i} : ")
                file.write(' '.join(map(str, route)))
                file.write(" \n")

def solve_pdptw(input_file: str, output_file: str, num_vehicles: int):
    """Main function để giải PDPTW"""
    # Parse input
    print("Đang đọc dữ liệu...")
    instance = parse_input(input_file)
    
    print(f"Instance: {instance.name}")
    print(f"Số nodes: {instance.size}")
    print(f"Capacity: {instance.capacity}")
    print(f"Số pickup-delivery pairs: {len([n for n in instance.nodes if n.is_pickup()])}")
    
    # Solve
    print("Đang giải bài toán...")
    solver = PDPTWSolver(instance, num_vehicles)
    solution = solver.solve()
    
    if solution:
        print(f"Tìm được giải pháp!")
        print(f"Số routes sử dụng: {len([r for r in solution['routes'] if r])}")
        print(f"Tổng nodes đã phục vụ: {sum(len(route) for route in solution['routes'])}")
        print(f"Tổng chi phí: {solution['total_cost']}")
        
        # Write output
        write_output(output_file, instance, solution)
        print(f"Kết quả đã được ghi vào {output_file}")
    else:
        print("Không tìm được giải pháp khả thi!")

if __name__ == "__main__":
    input_file = "input.txt"
    output_file = "output.txt"
    
    num_vehicles = int(input("Nhập số lượng xe: "))
    solve_pdptw(input_file, output_file, num_vehicles)