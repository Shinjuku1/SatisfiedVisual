# Satisfactory 1.1 Visual Planner
Satisfactory Visual Planner
A powerful, browser-based tool designed to help FICSIT engineers plan, build, and optimize complex factory layouts with an intuitive, node-based visual interface. Built with vanilla JavaScript and Tailwind CSS, it provides a feature-rich experience with no installation required.

Introduction
This planner allows you to visually design production lines by dragging recipe cards onto an infinite canvas and connecting their inputs and outputs. The tool provides real-time feedback on production rates and power usage, automatically highlighting any resource deficits in your chain to help you spot and fix bottlenecks before you even build.

Key Features
Visual, Node-Based Interface: Drag and drop recipes from a comprehensive library to represent buildings or entire production wings.

Real-Time Calculations: Instantly see calculated production rates and precise power usage, with accurate formulas for overclocking, underclocking, and upgrades like Somersloops.

Dynamic Power Plants: Power generator cards can be dynamically switched between all valid fuel types (e.g., Uranium, Plutonium, and Ficsonium Fuel Rods for Nuclear Plants).

Recipe Book: Manage your in-game progress by enabling or disabling unlocked alternate recipes. The auto-builder will intelligently use your selections to find the most efficient production lines.

Blueprint System: Save, load, and share your complete factory layouts as JSON files. The planner also features a robust autosave to prevent loss of work.

Advanced Automation Tools
The planner includes several powerful automation features to streamline the design process:

Auto-Build: Right-click any card to automatically generate and connect the entire upstream production chain required to supply it. The builder intelligently selects the best recipes based on your unlocked alternates and will upgrade existing production lines before building new ones.

Auto-Balance: Automatically adjusts the building counts and clock speeds of an entire production line to perfectly match demand, eliminating waste and deficits.

Auto-Arrange: Organizes even the most complex, sprawling factories into clean, logical groups based on production flow, making them easy to read and understand.

How to Use
Drag & Drop: Drag a recipe from the library on the left onto the canvas.

Connect Nodes: Drag a connection from an output node (green) on one card to a matching input node (orange) on another.

Configure: Right-click a card and select "Configure" to adjust building counts, clock speed, and other upgrades.

Automate: Right-click a card to access the powerful Auto-Build, Auto-Balance, and Auto-Arrange features.

Technology Stack
Vanilla JavaScript (ES6 Modules)

HTML5

Tailwind CSS

Support the Project
If you find this tool useful, please consider supporting its development!
https://buymeacoffee.com/shinjuku1
