import React, { useState, useEffect } from 'react';

const NodeList = ({ instance, onClickNode, highlightMarkers, selectedNodes }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  useEffect(() => {
    // Clear selection when dropdown closes
    if (!isDropdownOpen && selectedNodes) {
      selectedNodes.forEach(node => highlightMarkers(node, false));
    }
  }, [isDropdownOpen, selectedNodes, highlightMarkers]);

  if (!instance || !instance.nodes || instance.nodes.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors duration-200"
        onClick={toggleDropdown}
      >
        <div className="flex items-center space-x-3">
          <i className="fa fa-map-marker-alt text-blue-600"></i>
          <span className="font-medium text-gray-700">Nodes</span>
        </div>
        <i className={`fa fa-angle-down text-gray-400 transform transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
      </button>
      <div
        id="nodes_dropdown"
        className={`bg-gray-50 max-h-40 overflow-y-auto ${isDropdownOpen ? 'block' : 'hidden'}`}
      >
        {instance.nodes.map((node) => {
          let iconClass = '';
          if (node.is_depot) {
            iconClass = 'depot-icon';
          } else if (node.is_pickup) {
            iconClass = 'pickup-icon';
          } else if (node.is_delivery) {
            iconClass = 'delivery-icon';
          }

          const isSelected = selectedNodes && (selectedNodes.some(n => n.id === node.id) || (node.pair && selectedNodes.some(n => n.id === node.pair)));

          return (
            <a
              key={node.id}
              href="#"
              className={`node-item ${isSelected ? 'selected' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onClickNode(node);
              }}
              onMouseEnter={() => {
                if (!selectedNodes) {
                  highlightMarkers(node, true);
                }
              }}
              onMouseLeave={() => {
                if (!selectedNodes) {
                  highlightMarkers(node, false);
                }
              }}
            >
              <i className={`fa fa-circle ${iconClass}`}></i>
              {node.string_name()}
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default NodeList;
