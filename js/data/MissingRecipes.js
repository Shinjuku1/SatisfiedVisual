{
  "recipes": {
    "Assembler": [
      {name: 'Compacted Coal', inputs: {'Coal': 25, 'Sulfur': 25}, outputs: {'Compacted Coal': 12.5}}
    ],
    "Manufacturer": [
      {name: 'Heavy Modular Frame', inputs: {'Modular Frame': 7.5, 'Encased Industrial Beam': 9.375, 'Steel Pipe': 33.75, 'Concrete': 20.625}, outputs: {'Heavy Modular Frame': 2.8125}, isAlternate: true},
      {name: 'Heavy Modular Frame', inputs: {'Modular Frame': 18.75, 'Encased Industrial Beam': 11.25, 'Rubber': 75, 'Screw': 390}, outputs: {'Heavy Modular Frame': 3.75}, isAlternate: true}
    ],
    "Constructor": [
      {name: 'Candy Cane', inputs: {'Sugar': 15}, outputs: {'Candy Cane': 5}},
      {name: 'FICSMAS Bow', inputs: {'Fabric': 3}, outputs: {'FICSMAS Bow': 1}},
      {name: 'Copper FICSMAS Ornament', inputs: {'Copper Sheet': 5}, outputs: {'Copper FICSMAS Ornament': 5}},
      {name: 'Iron FICSMAS Ornament', inputs: {'Iron Plate': 5}, outputs: {'Iron FICSMAS Ornament': 5}}
    ],
    "Assembler": [
      {name: 'FICSMAS Ornament Bundle', inputs: {'Copper FICSMAS Ornament': 1, 'Iron FICSMAS Ornament': 1}, outputs: {'FICSMAS Ornament Bundle': 1}},
      {name: 'FICSMAS Wreath', inputs: {'FICSMAS Tree Branch': 15, 'FICSMAS Ornament Bundle': 6}, outputs: {'FICSMAS Wreath': 2}},
      {name: 'FICSMAS Wonder Star', inputs: {'FICSMAS Wreath': 5, 'Candy Cane': 20}, outputs: {'FICSMAS Wonder Star': 1}},
      {name: 'Sparkly Fireworks', inputs: {'FICSMAS Tree Branch': 3, 'FICSMAS Actual Snow': 2}, outputs: {'Sparkly Fireworks': 1}},
      {name: 'Sweet Fireworks', inputs: {'FICSMAS Tree Branch': 6, 'Candy Cane': 3}, outputs: {'Sweet Fireworks': 1}}
    ],
    "Packager": [
      {name: 'FICSMAS Gift', inputs: {'Packaged Water': 20, 'Packaged Oil': 20, 'Packaged Coal': 20}, outputs: {'FICSMAS Gift': 20}}
    ]
  }
}
