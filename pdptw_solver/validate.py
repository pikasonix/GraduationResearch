#!/usr/bin/env python3
"""
Quick validation script for PDPTW solutions
Calls the external validator and displays results
"""

import subprocess
import sys
import os
from pathlib import Path

VALIDATOR_PATH = r"D:\Docments\20251\GR2\_PDPTW benchmark\PDPTW Li & Lim benchmark\validator\validator.py"

def find_solution_file(path: str) -> str:
    """
    Find the actual solution file if path is a directory
    
    Args:
        path: Path to solution file or directory
        
    Returns:
        Path to the solution file
    """
    if os.path.isdir(path):
        # If it's a directory, find the first .txt or .sol file
        for file in os.listdir(path):
            if file.endswith('.txt') or file.endswith('.sol'):
                return os.path.join(path, file)
        raise FileNotFoundError(f"No solution file found in directory: {path}")
    return path

def validate_solution(instance_file: str, solution_file: str) -> bool:
    """
    Validate a PDPTW solution using the Python validator
    
    Args:
        instance_file: Path to instance file
        solution_file: Path to solution file or directory containing solution
        
    Returns:
        True if solution is valid, False otherwise
    """
    try:
        # Handle case where solution_file is a directory
        actual_solution_file = find_solution_file(solution_file)
        
        print(f"Using solution file: {actual_solution_file}\n")
        
        result = subprocess.run(
            ["python", VALIDATOR_PATH, "-i", instance_file, "-s", actual_solution_file],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
            
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("ERROR: Validator timed out after 30 seconds")
        return False
    except FileNotFoundError:
        print(f"ERROR: Validator not found at {VALIDATOR_PATH}")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python validate.py <instance_file> <solution_file>")
        sys.exit(1)
    
    instance = sys.argv[1]
    solution = sys.argv[2]
    
    print("="*60)
    print("PDPTW Solution Validator")
    print("="*60)
    print(f"Instance: {instance}")
    print(f"Solution: {solution}")
    print()
    
    is_valid = validate_solution(instance, solution)
    
    print()
    print("="*60)
    if is_valid:
        print("✓ VALIDATION PASSED")
    else:
        print("✗ VALIDATION FAILED")
    print("="*60)
    
    sys.exit(0 if is_valid else 1)
