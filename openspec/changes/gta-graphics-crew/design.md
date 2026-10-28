# Half-lambert on the crew

The crew material fills with its own albedo, so a skin shader or a new mesh does not fit this pass. The form is the half-lambert wrap from Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (SIGGRAPH 2007): `saturate(n·l * 0.5 + 0.5)` squared. It runs in the existing comic post process, and only where the crew stencil is set. The key is a fixed afternoon south-west vector, because that node cannot read the directional light. The clear 15:00 multipliers stay as they are.
