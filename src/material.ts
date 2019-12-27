import { Mesh3D, MeshGeometryData } from "./mesh"

export enum MaterialShaderAttribute {
  position = "position",
  uv1 = "uv1",
  normal = "normal",
  tangent = "tangent"
}

export abstract class Material {
  protected _mesh?: Mesh3D
  protected state = Object.assign(new PIXI.State(), {
    culling: true, clockwiseFrontFace: false, depthTest: true
  })
  protected geometry?: PIXI.Geometry
  protected shader?: PIXI.Shader

  get renderable() {
    return true
  }

  get mesh() {
    if (!this._mesh) {
      throw new Error("PIXI3D: Material needs to be bound to a mesh.")
    }
    return this._mesh
  }

  transparent = false

  constructor(public attributes: MaterialShaderAttribute[] = []) { }

  abstract createShader(renderer: any): PIXI.Shader
  abstract updateUniforms?(shader: PIXI.Shader): void

  bind(mesh: Mesh3D) {
    if (this._mesh) {
      throw new Error("PIXI3D: Material is already bound to a mesh.")
    }
    this._mesh = mesh
  }

  createGeometry(data: MeshGeometryData): PIXI.Geometry {
    let geometry = new PIXI.Geometry()
    if (data.indices) {
      // PIXI seems to have problems using anything other than gl.UNSIGNED_SHORT 
      // or gl.UNSIGNED_INT. Let's convert buffer to UNSIGNED_INT.
      geometry.addIndex(new Uint32Array(data.indices.buffer))
    }
    if (this.attributes.includes(MaterialShaderAttribute.position)) {
      geometry.addAttribute("a_Position", data.positions.buffer, 3, false,
        PIXI.TYPES.FLOAT, data.positions.stride)
    }
    if (this.attributes.includes(MaterialShaderAttribute.uv1)) {
      if (data.texCoords) {
        geometry.addAttribute("a_UV1", data.texCoords.buffer, 2, false,
          PIXI.TYPES.FLOAT, data.texCoords.stride)
      }
    }
    if (this.attributes.includes(MaterialShaderAttribute.normal)) {
      if (data.normals) {
        geometry.addAttribute("a_Normal", data.normals.buffer, 3, false,
          PIXI.TYPES.FLOAT, data.normals.stride)
      }
    }
    if (this.attributes.includes(MaterialShaderAttribute.tangent)) {
      if (data.tangents) {
        geometry.addAttribute("a_Tangent", data.tangents.buffer, 4, false,
          PIXI.TYPES.FLOAT, data.tangents.stride)
      }
    }
    return geometry
  }

  render(renderer: any) {
    if (!this.renderable) {
      return
    }
    if (!this.geometry) {
      this.geometry = this.createGeometry(this.mesh.geometry)
    }
    if (!this.shader) {
      this.shader = this.createShader(renderer)
    }
    if (this.updateUniforms) {
      this.updateUniforms(this.shader)
    }
    renderer.shader.bind(this.shader)
    renderer.state.set(this.state)
    renderer.geometry.bind(this.geometry, this.shader)
    renderer.geometry.draw(PIXI.DRAW_MODES.TRIANGLES)
  }
}

export interface MaterialFactory {
  create(source: unknown): Material
}