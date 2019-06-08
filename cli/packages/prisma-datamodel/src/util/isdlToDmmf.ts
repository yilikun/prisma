import { ISDL, IGQLField } from '../datamodel/model'
import { isTypeIdentifier } from '../datamodel/scalar'
import { keyBy, Dictionary } from './util'

export namespace DMMF {
  export interface Datamodel {
    models: Model[]
    enums: Enum[]
  }

  export interface Enum {
    name: string
    values: string[]
    dbName?: string | null
  }

  export interface DataSource {
    type: string
    url: string
    name: string
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    dbName: string | null
    fields: Field[]
    [key: string]: any // safe net for additional new props
  }

  export type FieldKind = 'scalar' | 'object' | 'enum'

  export interface Field {
    kind: FieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    type: string
    dbName: string | null
    isGenerated: boolean
    relationToFields?: any[]
    relationOnDelete?: string
    relationName?: string
    isUpdatedAt: boolean
    default?: {
      name: string
      returnType: string
      args: any[]
    }
    [key: string]: any // safe net for additional new props
  }
}

function getKind(
  field: IGQLField,
  enumMap: Dictionary<DMMF.Enum>,
): DMMF.FieldKind {
  if (typeof field.type === 'string' && isTypeIdentifier(field.type)) {
    return 'scalar'
  }

  if (typeof field.type === 'string') {
    if (enumMap[field.type]) {
      return 'enum'
    }
  } else {
    if (enumMap[field.type.name]) {
      return 'enum'
    }
  }

  return 'object'
}

function mapIdType(type: string): string {
  const map = {
    ID: 'String',
    UUID: 'String',
  }
  return map[type] || type
}

function getType(field: IGQLField): string {
  if (typeof field.type === 'string') {
    return field.type
  }

  return field.type.name
}

export function isdlToDmmfDatamodel(
  isdl: ISDL,
  dataSources: DMMF.DataSource[] = [],
): { dmmf: DMMF.Datamodel; dataSources: DMMF.DataSource[] } {
  const enums: DMMF.Enum[] = isdl.types
    .filter(t => t.isEnum)
    .map(type => {
      return {
        name: type.name,
        values: type.fields.map(f => f.name),
      }
    })

  const enumMap = keyBy(enums, e => e.name)

  const models: DMMF.Model[] = isdl.types
    .filter(t => !t.isEnum)
    .map(type => {
      return {
        name: type.name,
        isEmbedded: type.isEmbedded,
        dbName: type.databaseName,
        fields: type.fields.map(field => {
          const kind = getKind(field, enumMap)
          let defaultValue
          if (field.type === 'ID') {
            defaultValue = {
              name: 'cuid',
              returnType: 'String',
              args: [],
            }
          }

          if (field.type === 'UUID') {
            defaultValue = {
              name: 'uuid',
              returnType: 'String',
              args: [],
            }
          }

          if (field.isCreatedAt) {
            defaultValue = {
              name: 'now',
              returnType: 'DateTime',
              args: [],
            }
          }

          return {
            name: field.name,
            kind,
            dbName: field.databaseName,
            isGenerated: false,
            isId: field.isId,
            isList: field.isList,
            isRequired: field.isRequired,
            isUnique: field.isUnique,
            relationName: field.relationName,
            type: mapIdType(getType(field)),
            default: defaultValue,
            isUpdatedAt: field.isUpdatedAt,
          } as DMMF.Field
        }),
      }
    })

  return { dmmf: { models, enums }, dataSources }
}
