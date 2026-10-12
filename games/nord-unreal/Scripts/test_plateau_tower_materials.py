"""Regress the saved roof-parent dependency that failed fresh native loading."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import plateau_tower as tower


class Asset:
    def __init__(self, path):
        self.path, self.parent = path, None

    def get_path_name(self):
        return self.path + '.' + self.path.rsplit('/', 1)[-1]

    def get_editor_property(self, name):
        assert name == 'parent'
        return self.parent


class Assets:
    def __init__(self, root, failed_save=None, omit_package=None):
        self.root, self.failed_save, self.omit_package = root, failed_save, omit_package
        self.assets, self.events = {}, []

    def does_asset_exist(self, path):
        return path in self.assets

    def load_asset(self, path):
        return self.assets[path]

    def duplicate_asset(self, source, target):
        assert source.startswith('/Game/CityBuildings/')
        self.events.append(('copy', source, target))
        self.assets[target] = Asset(target)
        return self.assets[target]

    def save_loaded_asset(self, asset):
        self.events.append(('save', asset.path))
        if asset.path == self.failed_save:
            return False
        if asset.path != self.omit_package:
            package = self.root / ('Content/' + asset.path.removeprefix('/Game/') + '.uasset')
            package.parent.mkdir(parents=True, exist_ok=True)
            package.write_bytes(b'owned roof dependency fixture')
        return True


def run(name, city_id, *, failed_save=None, omit_package=None, wrong_parent=False):
    with TemporaryDirectory() as directory:
        original_root, tower.ROOT = tower.ROOT, Path(directory)
        try:
            assets = Assets(tower.ROOT, failed_save, omit_package)

            def set_parent(instance, parent):
                assert ('save', parent.path) in assets.events, 'Parent must be persisted first'
                assets.events.append(('parent', instance.path, parent.path))
                instance.parent = Asset('/Game/IncorrectParent') if wrong_parent else parent

            u = SimpleNamespace(EditorAssetLibrary=assets,
                                MaterialEditingLibrary=SimpleNamespace(set_material_instance_parent=set_parent))
            instance = tower.roof_material(u, name, city_id)
            parent_path = '/Game/Plateau/Materials/M_' + name + 'RoofParent'
            roof_path = '/Game/Plateau/Materials/MI_' + name + 'Roof'
            assert instance is assets.assets[roof_path]
            assert instance.parent is assets.assets[parent_path]
            assert assets.events == [('copy', '/Game/CityBuildings/M_CityFacade', parent_path),
                                     ('save', parent_path),
                                     ('copy', '/Game/CityBuildings/MI_' + city_id, roof_path),
                                     ('parent', roof_path, parent_path), ('save', roof_path)]
            # The repair path also saves/reparents already-created instances without copying.
            assets.events.clear()
            assert tower.roof_material(u, name, city_id) is instance
            assert assets.events == [('save', parent_path), ('parent', roof_path, parent_path),
                                     ('save', roof_path)]
        finally:
            tower.ROOT = original_root


def main():
    for name, city_id in [('LeNeuville', '2317003'), ('LePlateauSchool', '2316935')]:
        run(name, city_id)
        paths = ['/Game/Plateau/Materials/M_' + name + 'RoofParent',
                 '/Game/Plateau/Materials/MI_' + name + 'Roof']
        cases = [{'failed_save': path} for path in paths]
        cases += [{'omit_package': path} for path in paths]
        cases += [{'wrong_parent': True}]
        for case in cases:
            try:
                run(name, city_id, **case)
            except AssertionError:
                pass
            else:
                raise AssertionError('Dependency failure was accepted: ' + repr(case))
    print('PASS: both landmark roofs persist parents before instances, repair existing assets, and reject failed saves, missing packages and wrong parents')


if __name__ == '__main__':
    main()
