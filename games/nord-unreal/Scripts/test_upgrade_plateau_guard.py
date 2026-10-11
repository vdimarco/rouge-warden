"""CPU-only guard checks: regeneration accepts the baked merge, never old Warden layers."""
import ast
from pathlib import Path


script = ast.parse(Path(__file__).with_name('upgrade_plateau.py').read_text())
guard = next(node for node in script.body if isinstance(node, ast.FunctionDef)
             and node.name == 'require_integrated_inventory')
namespace = {}
exec(compile(ast.Module(body=[guard], type_ignores=[]), 'upgrade_plateau.py', 'exec'), namespace)
require_integrated_inventory = namespace['require_integrated_inventory']


class ActorClass:
    def __init__(self, name): self.name = name
    def get_name(self): return self.name


class Actor:
    def __init__(self, label, name): self.label, self.name = label, name
    def get_actor_label(self): return self.label
    def get_class(self): return ActorClass(self.name)


def actors():
    return [Actor('Plateau mapped vegetation', 'QuebecVegetation'),
            Actor('Your first car', 'QuebecCar'),
            *(Actor('Comic parked car ' + str(i), 'QuebecCar') for i in range(8)),
            *(Actor('Comic resident ' + str(i), 'QuebecParkResident') for i in range(14))]


counts = {'instances': 0, 'residents': 14, 'cars': 9, 'starts': 4, 'rings': 0, 'beacons': 0}
require_integrated_inventory(counts, actors())


def must_reject(values, scene):
    try:
        require_integrated_inventory(values, scene)
    except AssertionError:
        return
    raise AssertionError('Unsafe Plateau regeneration input was accepted')


must_reject(counts | {'instances': 1}, actors() + [Actor('Comic park benches', 'QuebecParkInstances')])
must_reject(counts, actors() + [Actor('Comic park benches', 'QuebecParkInstances')])
must_reject(counts, actors() + [Actor('Municipal building 10', 'StaticMeshActor')])
must_reject(counts, actors() + [Actor('Comic park inventory trunks', 'StaticMeshActor')])
must_reject(counts, [actor for actor in actors() if actor.label != 'Plateau mapped vegetation'])
must_reject(counts, actors() + [Actor('Another vegetation', 'QuebecVegetation')])
must_reject(counts, [actor for actor in actors() if actor.label != 'Comic parked car 7'])
must_reject(counts | {'starts': 3}, actors())
must_reject(counts | {'rings': 1}, actors())

# Reject unsupported maps before the first map save or asset import.
guard_index = next(i for i, node in enumerate(script.body) if isinstance(node, ast.Expr)
                   and isinstance(node.value, ast.Call)
                   and isinstance(node.value.func, ast.Name)
                   and node.value.func.id == 'require_integrated_inventory')
first_save_index = next(i for i, node in enumerate(script.body) if isinstance(node, ast.Assert)
                        and isinstance(node.test, ast.Call)
                        and isinstance(node.test.func, ast.Attribute)
                        and node.test.func.attr == 'save_current_level')
assert guard_index < first_save_index
print('Integrated Plateau regeneration guard checks passed')
