# Graph Explorer Deep Refactoring Plan

## Overview
This document outlines the comprehensive refactoring plan to separate the three main components of the Graph Explorer application and establish a clean, maintainable architecture.

## Current Issues
The existing `graph-explorer.tsx` file (3194 lines) contains:
- Mixed responsibilities across all three domains
- Rule evaluation logic scattered throughout
- Clustering algorithms embedded within visualization
- No clear separation of concerns
- Difficult to maintain and extend

## Target Architecture

### 1. Graph Visualization (`components/graph/`)
**Purpose**: Pure visualization component with no business logic
**Responsibilities**:
- Render nodes and edges based on provided data
- Handle user interactions (hover, click, selection)
- Manage visual state (colors, sizes, positions)
- Layout management and SVG rendering

**Input**: Nodes, edges, layout configuration
**Output**: Visual representation and interaction events
**No**: Calculations, rule evaluation, clustering logic

### 2. Match Score Calculator (`components/match-score/`)
**Purpose**: Rule evaluation and edge calculation engine
**Responsibilities**:
- Evaluate match rules between node pairs
- Calculate edge scores and types
- Handle rule precedence and scoring weights
- Generate unified edge representations

**Input**: Node data and rule definitions
**Output**: Calculated edges with scores and metadata
**No**: Visualization, clustering, user interactions

### 3. Clustering Algorithm (`components/clustering/`)
**Purpose**: Node clustering based on edge relationships
**Responsibilities**:
- Three-pass clustering algorithm
- Respect negative edge constraints
- Optimize cluster assignments
- Calculate clustering quality metrics

**Input**: Nodes and calculated edges
**Output**: Cluster assignments and quality metrics
**No**: Visualization, rule evaluation, user interactions

## Implementation Phases

### Phase 1: Extract Types and Interfaces ✅
- [x] Create `types/common.ts` for shared types
- [x] Create `types/match-rules.ts` for rule-related types
- [x] Create `types/clustering.ts` for clustering types
- [x] Create `types/graph.ts` for visualization types

### Phase 2: Extract Match Score Logic ✅
- [x] Create `components/match-score/MatchRules.tsx` for rule definitions
- [x] Create `components/match-score/RuleEvaluator.tsx` for rule evaluation
- [x] Create `components/match-score/MatchScoreCalculator.tsx` for edge calculations

### Phase 3: Extract Clustering Algorithm ✅
- [x] Create `components/clustering/ClusteringAlgorithm.tsx` for clustering logic

### Phase 4: Extract Graph Visualization ✅
- [x] Create `components/graph/GraphVisualization.tsx` for main visualization
- [x] Create `components/graph/GraphContainer.tsx` for SVG container

### Phase 5: Create Hooks and State Management ✅
- [x] Create `hooks/useGraphData.ts` for graph data management
- [x] Create `hooks/useMatchScore.ts` for match score calculations
- [x] Create `hooks/useClustering.ts` for clustering state

### Phase 6: Complete Component Extraction (In Progress)
- [ ] Create `components/graph/NodeRenderer.tsx` for node rendering
- [ ] Create `components/graph/EdgeRenderer.tsx` for edge rendering
- [ ] Create utility functions in `utils/` directory
- [ ] Refactor main component to use new architecture

### Phase 7: Testing and Validation
- [ ] Ensure all functionality works as expected
- [ ] Validate separation of concerns
- [ ] Test performance improvements
- [ ] Update documentation

## File Structure

```
src/
├── components/
│   ├── graph/                          # Graph visualization
│   │   ├── GraphVisualization.tsx      # Main visualization component
│   │   ├── GraphContainer.tsx          # SVG container
│   │   ├── NodeRenderer.tsx            # Node rendering logic
│   │   └── EdgeRenderer.tsx            # Edge rendering logic
│   ├── match-score/                    # Match score calculation
│   │   ├── MatchRules.tsx              # Rule definitions
│   │   ├── RuleEvaluator.tsx           # Rule evaluation engine
│   │   └── MatchScoreCalculator.tsx    # Edge calculation
│   ├── clustering/                     # Clustering algorithms
│   │   └── ClusteringAlgorithm.tsx     # Clustering logic
│   └── ui/                             # Existing UI components
├── hooks/                               # Custom hooks
│   ├── useGraphData.ts                  # Graph data management
│   ├── useMatchScore.ts                 # Match score calculations
│   └── useClustering.ts                 # Clustering state
├── types/                               # Type definitions
│   ├── common.ts                        # Shared types
│   ├── graph.ts                         # Graph types
│   ├── match-rules.ts                   # Rule types
│   └── clustering.ts                    # Clustering types
├── utils/                               # Utility functions
│   ├── graph-utils.ts                   # Graph utilities
│   ├── rule-utils.ts                    # Rule utilities
│   ├── clustering-utils.ts              # Clustering utilities
│   └── data-utils.ts                    # Data processing utilities
└── .cursorrules                         # Architecture enforcement rules
```

## Data Flow

```
Raw Data → useGraphData → NodeData
    ↓
NodeData → useMatchScore → Edges
    ↓
Edges + NodeData → useClustering → ClusterAssignments
    ↓
All Data → GraphVisualization → Rendered Graph
```

## Benefits of Refactoring

1. **Maintainability**: Each component has a single responsibility
2. **Testability**: Business logic can be tested independently
3. **Reusability**: Components can be reused in different contexts
4. **Performance**: Better separation allows for optimization
5. **Debugging**: Easier to isolate and fix issues
6. **Extension**: New features can be added without affecting existing code

## Migration Strategy

1. **Parallel Development**: New components are built alongside existing code
2. **Gradual Migration**: Functionality is moved piece by piece
3. **Validation**: Each phase is tested before proceeding
4. **Cleanup**: Old code is removed once migration is complete

## Next Steps

1. Complete the remaining component extraction
2. Create utility functions for common operations
3. Refactor the main component to use the new architecture
4. Test and validate all functionality
5. Remove old code and clean up
6. Update documentation and examples

## Architecture Rules

The `.cursorrules` file enforces:
- No cross-domain imports between the three main areas
- Clear naming conventions for functions
- Proper separation of concerns
- Consistent file organization

This ensures the architecture remains clean and maintainable as the codebase evolves. 