import * as THREE from 'three';
import { WeaponId, WeaponDefinition, getWeaponDef } from '@shared/combat/Weapons.ts';
import { BlockId } from '@shared/constants.ts';
import { BLOCK_DEFINITIONS } from '@shared/world/BlockTypes.ts';

export type WeaponSkinId = 'tactical' | 'cyberpunk' | 'gold_royale' | 'magma_core' | 'arctic_camo';

export class WeaponRenderer {
  public group: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private currentWeapon: WeaponDefinition;
  public skinId: WeaponSkinId = 'tactical';

  // Viewmodel Modes
  public mode: 'combat' | 'build' = 'combat';
  private combatGroup: THREE.Group;
  private builderGroup: THREE.Group;

  // Combat Visual Models & Flash
  private weaponMeshGroup: THREE.Group;
  private muzzleFlash: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private redDotSight: THREE.Mesh | null = null;
  private muzzleFlashTimer = 0;

  // Builder Visual Model (First-Person Arm + Held Block)
  private heldBlockMesh: THREE.Mesh;
  private heldBlockEdges: THREE.LineSegments;
  private heldBlockMaterial: THREE.MeshStandardMaterial;
  private currentBlockId: BlockId = BlockId.CONCRETE;

  // Viewmodel offsets & animations (ergonomically placed in camera view)
  private defaultPos = new THREE.Vector3(0.20, -0.15, -0.38);
  private adsPos = new THREE.Vector3(0.0, -0.125, -0.28);
  private currentPos = new THREE.Vector3();
  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Vector3();

  // Builder Swing / Punch Animation (Placing & Breaking blocks)
  private swingOffset = new THREE.Vector3();
  private swingRot = new THREE.Vector3();

  // Sway state
  private swayOffset = new THREE.Vector3();
  private swayRot = new THREE.Euler();

  // Reload state
  public isReloading = false;
  private reloadProgress = 0;
  private reloadDuration = 0;

  // ADS state
  public isADS = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.group = new THREE.Group();

    // 1. Combat Viewmodel Group
    this.combatGroup = new THREE.Group();
    this.weaponMeshGroup = new THREE.Group();
    this.combatGroup.add(this.weaponMeshGroup);
    this.group.add(this.combatGroup);

    this.currentWeapon = getWeaponDef(WeaponId.ASSAULT_RIFLE);
    this.currentPos.copy(this.defaultPos);
    this.group.position.copy(this.currentPos);

    // Muzzle Flash Mesh & Dynamic Flash Light
    const flashGeo = new THREE.ConeGeometry(0.06, 0.18, 5);
    flashGeo.rotateX(Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.95
    });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.visible = false;
    this.muzzleFlash.frustumCulled = false;
    this.combatGroup.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 9);
    this.combatGroup.add(this.muzzleLight);

    // Glowing Optical Red Dot Sight for ADS
    const redDotGeo = new THREE.BoxGeometry(0.008, 0.008, 0.008);
    const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    this.redDotSight = new THREE.Mesh(redDotGeo, redDotMat);
    this.redDotSight.position.set(0, 0.065, -0.15);
    this.redDotSight.visible = false;
    this.redDotSight.frustumCulled = false;
    this.combatGroup.add(this.redDotSight);

    // 2. Builder Viewmodel Group (Arm + 3D Mini Voxel Block)
    this.builderGroup = new THREE.Group();
    this.builderGroup.visible = false;

    // Builder Arm (Right Arm sleeve + Tactical Glove holding block)
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e2d3d, roughness: 0.85 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfab82, roughness: 0.6 });

    // Forearm reaching into view from lower-right
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.36), sleeveMat);
    forearm.position.set(0.12, -0.05, 0.10);
    forearm.rotation.set(-0.35, -0.18, -0.15);
    forearm.frustumCulled = false;

    // Wrist & Glove
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), gloveMat);
    wrist.position.set(0.06, -0.01, -0.05);
    wrist.rotation.set(-0.25, -0.15, -0.10);
    wrist.frustumCulled = false;

    // Thumb & fingers supporting the block
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.08), skinMat);
    fingers.position.set(0.01, 0.02, -0.12);
    fingers.frustumCulled = false;

    this.builderGroup.add(forearm, wrist, fingers);

    // Held 3D Voxel Block (Isometric presentation angle)
    const blockGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.heldBlockMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8d0d8,
      roughness: 0.65,
      metalness: 0.1
    });
    this.heldBlockMesh = new THREE.Mesh(blockGeo, this.heldBlockMaterial);
    this.heldBlockMesh.position.set(-0.04, 0.05, -0.14);
    this.heldBlockMesh.rotation.set(0.35, 0.60, 0.15);
    this.heldBlockMesh.frustumCulled = false;

    // Crisp Voxel Block Edge Highlights
    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1205, 0.1205, 0.1205));
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5 });
    this.heldBlockEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.heldBlockEdges.frustumCulled = false;
    this.heldBlockMesh.add(this.heldBlockEdges);

    this.builderGroup.add(this.heldBlockMesh);
    this.group.add(this.builderGroup);

    // Dedicated soft viewmodel ambient & directional fill lights (uniform illumination without blowout)
    const viewmodelDir = new THREE.DirectionalLight(0xffffff, 0.85);
    viewmodelDir.position.set(0.6, 1.2, 0.8);
    this.group.add(viewmodelDir);

    const viewmodelAmbient = new THREE.AmbientLight(0xffffff, 0.6);
    this.group.add(viewmodelAmbient);

    this.group.renderOrder = 100;
    this.rebuildModel(this.currentWeapon.id);
    this.setHeldBlock(BlockId.CONCRETE);
    this.setMode('combat');
    this.camera.add(this.group);
  }

  public setMode(mode: 'combat' | 'build'): void {
    this.mode = mode;
    this.combatGroup.visible = (mode === 'combat');
    this.builderGroup.visible = (mode === 'build');
    this.group.visible = true;
  }

  public setHeldBlock(blockId: BlockId): void {
    this.currentBlockId = blockId;
    const def = BLOCK_DEFINITIONS[blockId];
    if (!def) return;

    this.heldBlockMaterial.color.setRGB(def.color[0], def.color[1], def.color[2]);

    if (def.emissive) {
      this.heldBlockMaterial.emissive.setRGB(def.emissive[0], def.emissive[1], def.emissive[2]);
      this.heldBlockMaterial.emissiveIntensity = 1.2;
    } else {
      this.heldBlockMaterial.emissive.setHex(0x000000);
      this.heldBlockMaterial.emissiveIntensity = 0;
    }

    if (def.isTransparent && def.opacity !== undefined) {
      this.heldBlockMaterial.transparent = true;
      this.heldBlockMaterial.opacity = def.opacity;
    } else {
      this.heldBlockMaterial.transparent = false;
      this.heldBlockMaterial.opacity = 1.0;
    }

    this.heldBlockMaterial.metalness = (blockId === BlockId.METAL_DARK) ? 0.6 : 0.08;
    this.heldBlockMaterial.needsUpdate = true;
  }

  public triggerSwingAnimation(action: 'place' | 'break' = 'place'): void {
    if (action === 'place') {
      // Tactile forward punch placement
      this.swingOffset.set(0.03, -0.05, -0.14);
      this.swingRot.set(0.35, -0.22, 0.15);
    } else {
      // Impactful downward mining swing
      this.swingOffset.set(0.04, -0.08, -0.16);
      this.swingRot.set(0.55, -0.28, 0.25);
    }
  }

  public setWeapon(weaponId: WeaponId): void {
    this.currentWeapon = getWeaponDef(weaponId);
    this.rebuildModel(weaponId);
    this.isReloading = false;
  }

  public setSkin(skinId: WeaponSkinId): void {
    this.skinId = skinId;
    this.rebuildModel(this.currentWeapon.id);
  }

  private rebuildModel(id: WeaponId): void {
    // Clear previous model parts
    while (this.weaponMeshGroup.children.length > 0) {
      const child = this.weaponMeshGroup.children[0] as THREE.Mesh;
      this.weaponMeshGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    // Rebuild materials according to active skin theme
    let metalColor = 0x374251; // Crisp gunmetal grey
    let metalRoughness = 0.4;
    let metalness = 0.55;
    let accentColor = 0x7c4d29;
    let neonColor = 0x00ffcc;
    let neonEmissive = 0x00ddaa;
    let neonIntensity = 0.45;

    switch (this.skinId) {
      case 'cyberpunk':
        metalColor = 0x22123d; // Deep midnight violet
        metalRoughness = 0.35;
        metalness = 0.85;
        accentColor = 0xff007f; // Hot neon magenta
        neonColor = 0x00ffff;  // Cyan glow
        neonEmissive = 0x00ffff;
        neonIntensity = 0.75;
        break;

      case 'gold_royale':
        metalColor = 0xffc107; // 24K Polished Gold
        metalRoughness = 0.18;
        metalness = 0.95;
        accentColor = 0x2e180d; // Polished dark walnut
        neonColor = 0xfff8e7;  // Diamond shimmer
        neonEmissive = 0xffe082;
        neonIntensity = 0.5;
        break;

      case 'magma_core':
        metalColor = 0x1b1c20; // Volcanic obsidian
        metalRoughness = 0.6;
        metalness = 0.65;
        accentColor = 0xbf360c; // Burnt magma
        neonColor = 0xff6d00;  // Molten orange
        neonEmissive = 0xff3d00;
        neonIntensity = 0.8;
        break;

      case 'arctic_camo':
        metalColor = 0xecf0f5; // Pure alpine snow white
        metalRoughness = 0.4;
        metalness = 0.4;
        accentColor = 0x37474f; // Matte carbon slate
        neonColor = 0x40c4ff;  // Glacial ice blue
        neonEmissive = 0x00b0ff;
        neonIntensity = 0.6;
        break;

      case 'tactical':
      default:
        // Default tactical matte
        break;
    }

    const darkMetal = new THREE.MeshStandardMaterial({ color: metalColor, roughness: metalRoughness, metalness });
    const woodMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.85 });
    const neonCyan = new THREE.MeshStandardMaterial({ color: neonColor, emissive: neonEmissive, emissiveIntensity: neonIntensity });
    
    // First-person arms materials
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e2d3d, roughness: 0.85 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfab82, roughness: 0.6 });

    // Common First-Person Arms attached to weapon
    // 1. Right Arm (Gripping stock / trigger)
    const rightArmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.30), sleeveMat);
    rightArmSleeve.position.set(0.065, -0.065, 0.16);
    rightArmSleeve.rotation.set(-0.15, -0.15, 0.05);

    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.09), gloveMat);
    rightGlove.position.set(0.035, -0.04, 0.08);

    const rightFingers = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.05), skinMat);
    rightFingers.position.set(0.02, -0.03, 0.07);

    // 2. Left Arm (Supporting barrel / handguard)
    const leftArmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.34), sleeveMat);
    leftArmSleeve.position.set(-0.12, -0.075, 0.05);
    leftArmSleeve.rotation.set(0.25, 0.28, -0.15);

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 0.09), gloveMat);
    leftGlove.position.set(-0.03, -0.03, -0.16);

    const leftFingers = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.06), skinMat);
    leftFingers.position.set(-0.02, -0.02, -0.15);

    this.weaponMeshGroup.add(rightArmSleeve, rightGlove, rightFingers, leftArmSleeve, leftGlove, leftFingers);

    switch (id) {
      case WeaponId.ASSAULT_RIFLE: {
        // Body / Receiver
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.42), darkMetal);
        // Upper Picatinny Rail
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.34), darkMetal);
        rail.position.set(0, 0.052, -0.02);
        // Barrel
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.35), darkMetal);
        barrel.position.set(0, 0.025, -0.35);
        // Magazine clip
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.08), woodMat);
        mag.position.set(0, -0.1, -0.06);
        mag.rotation.x = 0.2;
        // Grip & Stock
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), woodMat);
        grip.position.set(0, -0.08, 0.1);
        grip.rotation.x = -0.3;
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), woodMat);
        stock.position.set(0, -0.01, 0.26);

        // Sleek Dual Side Accent Lights
        const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.24), neonCyan);
        trimLeft.position.set(-0.032, 0.02, -0.08);
        const trimRight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.24), neonCyan);
        trimRight.position.set(0.032, 0.02, -0.08);

        // Tactical Iron Sights
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.032, 0.015), darkMetal);
        frontSight.position.set(0, 0.048, -0.35);
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.015), darkMetal);
        rearSight.position.set(0, 0.068, 0.06);

        this.weaponMeshGroup.add(body, rail, barrel, mag, grip, stock, trimLeft, trimRight, frontSight, rearSight);
        this.muzzleFlash.position.set(0, 0.025, -0.55);
        break;
      }

      case WeaponId.SNIPER_RIFLE: {
        // Long body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.55), darkMetal);
        // Long Barrel
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.55), darkMetal);
        barrel.position.set(0, 0.02, -0.48);
        // Scope Tube
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 8), darkMetal);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.09, -0.05);
        // Stock
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.28), darkMetal);
        stock.position.set(0, -0.02, 0.36);

        this.weaponMeshGroup.add(body, barrel, scope, stock);
        this.muzzleFlash.position.set(0, 0.02, -0.78);
        break;
      }

      case WeaponId.SHOTGUN: {
        // Heavy Receiver
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.38), darkMetal);
        // Dual or wide barrel
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.36), darkMetal);
        barrel.position.set(0, 0.02, -0.32);
        // Pump grip
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.14), woodMat);
        pump.position.set(0, -0.03, -0.22);
        // Stock
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.24), woodMat);
        stock.position.set(0, -0.03, 0.24);

        this.weaponMeshGroup.add(body, barrel, pump, stock);
        this.muzzleFlash.position.set(0, 0.02, -0.54);
        break;
      }

      case WeaponId.PISTOL: {
        // Slide
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.24), darkMetal);
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.07), woodMat);
        grip.position.set(0, -0.09, 0.04);
        grip.rotation.x = -0.25;

        // Position arms close together for a tight tactical two-hand pistol grip
        leftArmSleeve.position.set(-0.06, -0.08, 0.12);
        leftArmSleeve.rotation.set(0.1, 0.2, -0.08);
        leftGlove.position.set(-0.01, -0.04, 0.05);

        this.weaponMeshGroup.add(slide, grip);
        this.muzzleFlash.position.set(0, 0.02, -0.15);
        break;
      }
    }

    // Ensure viewmodel meshes are never culled by camera frustum
    this.weaponMeshGroup.traverse((obj) => {
      obj.frustumCulled = false;
    });
  }

  public triggerFireRecoil(): void {
    // Recoil kickback
    this.recoilOffset.z += 0.09;
    this.recoilOffset.y += 0.025;
    this.recoilRot.x += this.currentWeapon.recoilPitch;
    this.recoilRot.y += (Math.random() - 0.5) * this.currentWeapon.recoilYaw;

    // Trigger Dynamic Muzzle Light & Flash
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    const randomScale = 0.8 + Math.random() * 0.4;
    this.muzzleFlash.scale.set(randomScale, randomScale, randomScale);
    this.muzzleLight.intensity = 3.5;
    this.muzzleLight.position.copy(this.muzzleFlash.position);
    this.muzzleFlashTimer = 0.05; // 50ms flash
  }

  public startReload(): void {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadDuration = this.currentWeapon.reloadTimeMs / 1000;
  }

  public updateSway(movementX: number, movementY: number): void {
    const swayFactor = 0.0007;
    this.swayOffset.x = -movementX * swayFactor;
    this.swayOffset.y = movementY * swayFactor;
    this.swayRot.y = -movementX * swayFactor * 0.8;
    this.swayRot.x = -movementY * swayFactor * 0.8;
  }

  public update(dt: number, speed: number, isGrounded: boolean): void {
    // 1. Muzzle Flash & Light Decay
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlash.visible = false;
      }
    }
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 50);
    }

    // Toggle Optical Red Dot Sight during ADS in combat mode
    if (this.redDotSight) {
      this.redDotSight.visible = (this.mode === 'combat') && this.isADS;
    }

    // 2. Smooth ADS Transition (Combat Mode)
    const targetBasePos = (this.mode === 'combat' && this.isADS) ? this.adsPos : this.defaultPos;
    this.currentPos.lerp(targetBasePos, Math.min(1, dt * 16));

    // 3. Recoil Recovery Spring
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 14));
    this.recoilRot.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 14));

    // 4. Builder Swing / Punch Recovery Spring
    this.swingOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 15));
    this.swingRot.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 15));

    // 5. Sway Spring
    this.swayOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 10));
    this.swayRot.set(
      this.swayRot.x * 0.85,
      this.swayRot.y * 0.85,
      0
    );

    // 6. Reload Drop Animation (Combat Mode)
    let reloadOffsetY = 0;
    let reloadRotX = 0;
    if (this.isReloading && this.mode === 'combat') {
      this.reloadProgress += dt / this.reloadDuration;
      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      } else {
        const dip = Math.sin(this.reloadProgress * Math.PI);
        reloadOffsetY = -dip * 0.22;
        reloadRotX = -dip * 0.45;
      }
    }

    // 7. Apply Final Position & Rotation to viewmodel group
    if (this.mode === 'combat') {
      this.group.position.set(
        this.currentPos.x + this.recoilOffset.x + this.swayOffset.x,
        this.currentPos.y + this.recoilOffset.y + this.swayOffset.y + reloadOffsetY,
        this.currentPos.z + this.recoilOffset.z
      );

      this.group.rotation.set(
        this.recoilRot.x + this.swayRot.x + reloadRotX,
        this.recoilRot.y + this.swayRot.y,
        0,
        'YXZ'
      );
    } else {
      // Builder Viewmodel: arm and held block
      this.group.position.set(
        this.defaultPos.x + this.swingOffset.x + this.swayOffset.x * 0.5,
        this.defaultPos.y + this.swingOffset.y + this.swayOffset.y * 0.5,
        this.defaultPos.z + this.swingOffset.z
      );

      this.group.rotation.set(
        this.swingRot.x + this.swayRot.x * 0.5,
        this.swingRot.y + this.swayRot.y * 0.5,
        this.swingRot.z,
        'YXZ'
      );
    }
  }

  public getMuzzleWorldPosition(): THREE.Vector3 {
    const muzzle = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzle);
    return muzzle;
  }
}
