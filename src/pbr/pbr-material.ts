import * as PIXI from "pixi.js"

import { LightType } from "../lighting/light-type"
import { PhysicallyBasedFeatures } from "./pbr-features"
import { PhysicallyBasedMeshShader } from "./pbr-shader"
import { Material } from "../material"
import { Camera3D } from "../camera/camera"
import { glTFMaterial } from "../gltf/gltf-material"
import { LightingEnvironment } from "../lighting/lighting-environment"
import { Mesh3D } from "../mesh/mesh"
import { PhysicallyBasedMaterialDebugMode } from "./pbr-debug"
import { PhysicallyBasedMaterialAlphaMode } from "./pbr-alpha"

const shaders: { [features: string]: PhysicallyBasedMeshShader } = {}

export class PhysicallyBasedMaterial extends Material {
  private _lighting?: LightingEnvironment
  private _unlit = false
  private _alphaMode = PhysicallyBasedMaterialAlphaMode.opaque
  private _debugMode?: PhysicallyBasedMaterialDebugMode
  private _baseColorTexture?: PIXI.Texture
  private _metallicRoughnessTexture?: PIXI.Texture
  private _normalTexture?: PIXI.Texture
  private _occlusionTexture?: PIXI.Texture
  private _emissiveTexture?: PIXI.Texture

  roughness = 1
  metallic = 1
  baseColor = [1, 1, 1, 1]
  alphaMaskCutoff = 0.5
  exposure = 1

  get baseColorTexture() {
    return this._baseColorTexture
  }

  set baseColorTexture(value: PIXI.Texture | undefined) {
    if (value !== this._baseColorTexture) {
      this.invalidateShader()
      this._baseColorTexture = value
    }
  }

  get metallicRoughnessTexture() {
    return this._metallicRoughnessTexture
  }

  set metallicRoughnessTexture(value: PIXI.Texture | undefined) {
    if (value !== this._metallicRoughnessTexture) {
      this.invalidateShader()
      this._metallicRoughnessTexture = value
    }
  }

  get normalTexture() {
    return this._normalTexture
  }

  set normalTexture(value: PIXI.Texture | undefined) {
    if (value !== this._normalTexture) {
      this.invalidateShader()
      this._normalTexture = value
    }
  }

  get occlusionTexture() {
    return this._occlusionTexture
  }

  set occlusionTexture(value: PIXI.Texture | undefined) {
    if (value !== this._occlusionTexture) {
      this.invalidateShader()
      this._occlusionTexture = value
    }
  }

  get emissiveTexture() {
    return this._emissiveTexture
  }

  set emissiveTexture(value: PIXI.Texture | undefined) {
    if (value !== this._emissiveTexture) {
      this.invalidateShader()
      this._emissiveTexture = value
    }
  }

  get alphaMode() {
    return this._alphaMode
  }

  set alphaMode(value: PhysicallyBasedMaterialAlphaMode) {
    if (this._alphaMode !== value) {
      this._alphaMode = value
      if (this._alphaMode === PhysicallyBasedMaterialAlphaMode.opaque) {
        this.transparent = false
      } else {
        this.transparent = true
      }
      this.invalidateShader()
    }
  }

  get debugMode() {
    return this._debugMode
  }

  set debugMode(value: PhysicallyBasedMaterialDebugMode | undefined) {
    if (this._debugMode !== value) {
      this.invalidateShader()
      this._debugMode = value
    }
  }

  /**
   * Camera used when rendering a mesh. If this value is not set, the main camera 
   * will be used by default.
   */
  camera?: Camera3D

  private get cameraForRendering() {
    return this.camera || Camera3D.main
  }

  private get lightingForRendering() {
    return this.lighting || LightingEnvironment.main
  }

  /**
   * Lighting environment used when rendering a mesh. If this value is not set, 
   * the main lighting environment will be used by default.
   */
  get lighting() {
    return this._lighting
  }

  set lighting(value: LightingEnvironment | undefined) {
    if (value !== this._lighting) {
      this.invalidateShader()
      this._lighting = value
    }
  }

  get unlit() {
    return this._unlit
  }

  set unlit(value: boolean) {
    if (this._unlit !== value) {
      this._unlit = value
      this.invalidateShader()
    }
  }

  /**
   * Invalidates the shader so it can be rebuilt with the current features.
   */
  invalidateShader() {
    this._shader = undefined
  }

  /**
   * Creates a physically based material factory.
   * @param properties Properties to set on the material when created.
   */
  static factory(properties = {}) {
    return {
      create: (source: unknown) => {
        return <PhysicallyBasedMaterial>Object.assign(PhysicallyBasedMaterial.create(source), properties)
      }
    }
  }

  /**
   * Creates a new physically based material from the specified source.
   * @param source Source from which the material is created.
   */
  static create(source: unknown) {
    let material = new PhysicallyBasedMaterial()
    if (source instanceof glTFMaterial) {
      material.baseColor = source.baseColor
      material.baseColorTexture = source.baseColorTexture
      material.metallic = source.metallic
      material.roughness = source.roughness
      material.metallicRoughnessTexture = source.metallicRoughnessTexture
      switch (source.alphaMode) {
        case "BLEND": {
          material.alphaMode = PhysicallyBasedMaterialAlphaMode.blend
          break
        }
        case "MASK": {
          material.alphaMode = PhysicallyBasedMaterialAlphaMode.mask
          break
        }
      }
      material.emissiveTexture = source.emissiveTexture
      material.normalTexture = source.normalTexture
      material.occlusionTexture = source.occlusionTexture
      material.doubleSided = source.doubleSided
      material.alphaMaskCutoff = source.alphaMaskCutoff
    }
    return material
  }

  createShader(mesh: Mesh3D, renderer: PIXI.Renderer) {
    if (renderer.context.webGLVersion === 1) {
      let extensions = [
        "EXT_shader_texture_lod",
        "OES_standard_derivatives"
      ]
      for (let ext of extensions) {
        if (!renderer.gl.getExtension(ext)) {
          console.warn(`PIXI3D: Extension "${ext}" is not supported.`)
        }
      }
    }
    let features = PhysicallyBasedFeatures.build(mesh.geometry, this, this.lightingForRendering)
    if (!features) {
      // The shader features couldn't be built, some resources may still be 
      // loading. Don't worry, we will retry creating shader at next render.
      return undefined
    }
    let checksum = features.join(",")
    if (!shaders[checksum]) {
      shaders[checksum] = PhysicallyBasedMeshShader.build(renderer, features)
    }
    return shaders[checksum]
  }

  updateUniforms(mesh: Mesh3D, shader: PIXI.Shader) {
    shader.uniforms.u_ModelMatrix = mesh.transform.worldTransform.toArray()
    shader.uniforms.u_ViewProjectionMatrix = this.cameraForRendering.viewProjection
    shader.uniforms.u_NormalMatrix = mesh.transform.worldTransform.toArray()
    shader.uniforms.u_Camera = this.cameraForRendering.viewPosition
    shader.uniforms.u_MetallicFactor = this.metallic
    shader.uniforms.u_RoughnessFactor = this.roughness
    shader.uniforms.u_BaseColorFactor = this.baseColor
    shader.uniforms.u_Exposure = this.exposure

    if (this._alphaMode === PhysicallyBasedMaterialAlphaMode.mask) {
      shader.uniforms.u_AlphaCutoff = this.alphaMaskCutoff
    }
    if (mesh.geometry.weights) {
      shader.uniforms.u_morphWeights = mesh.geometry.weights
    }
    if (this.baseColorTexture?.valid) {
      shader.uniforms.u_BaseColorSampler = this.baseColorTexture
      shader.uniforms.u_BaseColorUVSet = 0
    }
    for (let i = 0; i < this.lightingForRendering.lights.length; i++) {
      let light = this.lightingForRendering.lights[i]
      let type = 0
      switch (light.type) {
        case LightType.point: type = 1; break
        case LightType.directional: type = 0; break
        case LightType.spot: type = 2; break
      }
      shader.uniforms[`u_Lights[${i}].type`] = type
      shader.uniforms[`u_Lights[${i}].position`] = light.worldPosition
      shader.uniforms[`u_Lights[${i}].direction`] = light.direction
      shader.uniforms[`u_Lights[${i}].range`] = light.range
      shader.uniforms[`u_Lights[${i}].color`] = light.color
      shader.uniforms[`u_Lights[${i}].intensity`] = light.intensity
      shader.uniforms[`u_Lights[${i}].innerConeCos`] = Math.cos(light.innerConeAngle)
      shader.uniforms[`u_Lights[${i}].outerConeCos`] = Math.cos(light.outerConeAngle)
      shader.uniforms[`u_Lights[${i}].padding`] = light.padding
    }
    if (this.lightingForRendering.ibl?.valid) {
      shader.uniforms.u_DiffuseEnvSampler = this.lightingForRendering.ibl.diffuse
      shader.uniforms.u_SpecularEnvSampler = this.lightingForRendering.ibl.specular
      shader.uniforms.u_brdfLUT = this.lightingForRendering.ibl.brdf
      shader.uniforms.u_MipCount = this.lightingForRendering.ibl.specular.levels - 1
    }
    if (this.emissiveTexture?.valid) {
      shader.uniforms.u_EmissiveSampler = this.emissiveTexture
      shader.uniforms.u_EmissiveUVSet = 0
      shader.uniforms.u_EmissiveFactor = [1, 1, 1]
    }
    if (this.normalTexture?.valid) {
      shader.uniforms.u_NormalSampler = this.normalTexture
      shader.uniforms.u_NormalScale = 1
      shader.uniforms.u_NormalUVSet = 0
    }
    if (this.metallicRoughnessTexture?.valid) {
      shader.uniforms.u_MetallicRoughnessSampler = this.metallicRoughnessTexture
      shader.uniforms.u_MetallicRoughnessUVSet = 0
    }
    if (this.occlusionTexture?.valid) {
      shader.uniforms.u_OcclusionSampler = this.occlusionTexture
      shader.uniforms.u_OcclusionStrength = 1
      shader.uniforms.u_OcclusionUVSet = 0
    }
  }
}