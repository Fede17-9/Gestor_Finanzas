// Generated from supabase/migrations by npm run db:types. Do not edit manually.
// This checks the versioned schema, not unversioned changes in Supabase Cloud.
export type DecimalString = `${number}`;
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      "aportes_metas": {
        Row: {
          "id_aporte": string;
          "id_meta": string;
          "id_usuario": string;
          "monto": number;
          "tipo": string;
          "fecha": string;
          "concepto": string;
          "id_origen": string | null;
          "creado_en": string;
        };
        Insert: {
          "id_aporte"?: string;
          "id_meta": string;
          "id_usuario": string;
          "monto": number | DecimalString;
          "tipo": string;
          "fecha": string;
          "concepto": string;
          "id_origen"?: string | null;
          "creado_en"?: string;
        };
        Update: {
          "id_aporte"?: string;
          "id_meta"?: string;
          "id_usuario"?: string;
          "monto"?: number | DecimalString;
          "tipo"?: string;
          "fecha"?: string;
          "concepto"?: string;
          "id_origen"?: string | null;
          "creado_en"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aportes_metas_id_meta_fkey";
            columns: ["id_meta"];
            isOneToOne: false;
            referencedRelation: "metas_ahorro";
            referencedColumns: ["id_meta"];
          },
          {
            foreignKeyName: "aportes_metas_id_origen_fkey";
            columns: ["id_origen"];
            isOneToOne: true;
            referencedRelation: "aportes_metas";
            referencedColumns: ["id_aporte"];
          },
          {
            foreignKeyName: "aportes_metas_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "categorias": {
        Row: {
          "id_categoria": string;
          "id_usuario": string | null;
          "nombre_categoria": string;
          "codigo_color": string | null;
          "slug_icono": string | null;
        };
        Insert: {
          "id_categoria"?: string;
          "id_usuario"?: string | null;
          "nombre_categoria": string;
          "codigo_color"?: string | null;
          "slug_icono"?: string | null;
        };
        Update: {
          "id_categoria"?: string;
          "id_usuario"?: string | null;
          "nombre_categoria"?: string;
          "codigo_color"?: string | null;
          "slug_icono"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "config_recurrencias": {
        Row: {
          "id_recurrencia": string;
          "id_usuario": string;
          "id_tipo": number;
          "id_categoria": string | null;
          "monto_recurrente": number;
          "frecuencia": string | null;
          "dia_ejecucion": number | null;
          "fecha_inicio": string;
          "fecha_fin": string | null;
          "estado_activo": boolean | null;
          "nombre": string;
          "confirmacion_automatica": boolean;
          "archivada": boolean;
          "generar_desde": string;
        };
        Insert: {
          "id_recurrencia"?: string;
          "id_usuario": string;
          "id_tipo": number;
          "id_categoria"?: string | null;
          "monto_recurrente": number | DecimalString;
          "frecuencia"?: string | null;
          "dia_ejecucion"?: number | null;
          "fecha_inicio": string;
          "fecha_fin"?: string | null;
          "estado_activo"?: boolean | null;
          "nombre"?: string;
          "confirmacion_automatica"?: boolean;
          "archivada"?: boolean;
          "generar_desde"?: string;
        };
        Update: {
          "id_recurrencia"?: string;
          "id_usuario"?: string;
          "id_tipo"?: number;
          "id_categoria"?: string | null;
          "monto_recurrente"?: number | DecimalString;
          "frecuencia"?: string | null;
          "dia_ejecucion"?: number | null;
          "fecha_inicio"?: string;
          "fecha_fin"?: string | null;
          "estado_activo"?: boolean | null;
          "nombre"?: string;
          "confirmacion_automatica"?: boolean;
          "archivada"?: boolean;
          "generar_desde"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "config_recurrencias_id_categoria_fkey";
            columns: ["id_categoria"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id_categoria"];
          },
          {
            foreignKeyName: "config_recurrencias_id_tipo_fkey";
            columns: ["id_tipo"];
            isOneToOne: false;
            referencedRelation: "tipos_movimiento";
            referencedColumns: ["id_tipo"];
          },
          {
            foreignKeyName: "config_recurrencias_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "historial_recurrencias": {
        Row: {
          "id_evento": string;
          "id_usuario": string;
          "id_recurrencia": string;
          "id_ocurrencia": string | null;
          "accion": string;
          "detalle": Json;
          "creado_en": string;
        };
        Insert: {
          "id_evento"?: string;
          "id_usuario": string;
          "id_recurrencia": string;
          "id_ocurrencia"?: string | null;
          "accion": string;
          "detalle"?: Json;
          "creado_en"?: string;
        };
        Update: {
          "id_evento"?: string;
          "id_usuario"?: string;
          "id_recurrencia"?: string;
          "id_ocurrencia"?: string | null;
          "accion"?: string;
          "detalle"?: Json;
          "creado_en"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historial_recurrencias_id_ocurrencia_fkey";
            columns: ["id_ocurrencia"];
            isOneToOne: false;
            referencedRelation: "ocurrencias_recurrentes";
            referencedColumns: ["id_ocurrencia"];
          },
          {
            foreignKeyName: "historial_recurrencias_id_recurrencia_fkey";
            columns: ["id_recurrencia"];
            isOneToOne: false;
            referencedRelation: "config_recurrencias";
            referencedColumns: ["id_recurrencia"];
          },
          {
            foreignKeyName: "historial_recurrencias_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "metas_ahorro": {
        Row: {
          "id_meta": string;
          "id_usuario": string;
          "nombre_meta": string;
          "monto_objetivo": number;
          "monto_actual": number | null;
          "fecha_proyectada": string | null;
          "prioridad_nivel": string | null;
          "estado_meta": string | null;
          "archivada": boolean;
        };
        Insert: {
          "id_meta"?: string;
          "id_usuario": string;
          "nombre_meta": string;
          "monto_objetivo": number | DecimalString;
          "monto_actual"?: number | DecimalString | null;
          "fecha_proyectada"?: string | null;
          "prioridad_nivel"?: string | null;
          "estado_meta"?: string | null;
          "archivada"?: boolean;
        };
        Update: {
          "id_meta"?: string;
          "id_usuario"?: string;
          "nombre_meta"?: string;
          "monto_objetivo"?: number | DecimalString;
          "monto_actual"?: number | DecimalString | null;
          "fecha_proyectada"?: string | null;
          "prioridad_nivel"?: string | null;
          "estado_meta"?: string | null;
          "archivada"?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "metas_ahorro_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "movimientos": {
        Row: {
          "id_movimiento": string;
          "id_usuario": string;
          "id_tipo": number;
          "id_categoria": string | null;
          "monto_transaccion": number;
          "metodo_pago": string | null;
          "fecha_operacion": string | null;
          "descripcion_detalle": string | null;
          "es_automatico": boolean | null;
          "id_ocurrencia": string | null;
        };
        Insert: {
          "id_movimiento"?: string;
          "id_usuario": string;
          "id_tipo": number;
          "id_categoria"?: string | null;
          "monto_transaccion": number | DecimalString;
          "metodo_pago"?: string | null;
          "fecha_operacion"?: string | null;
          "descripcion_detalle"?: string | null;
          "es_automatico"?: boolean | null;
          "id_ocurrencia"?: string | null;
        };
        Update: {
          "id_movimiento"?: string;
          "id_usuario"?: string;
          "id_tipo"?: number;
          "id_categoria"?: string | null;
          "monto_transaccion"?: number | DecimalString;
          "metodo_pago"?: string | null;
          "fecha_operacion"?: string | null;
          "descripcion_detalle"?: string | null;
          "es_automatico"?: boolean | null;
          "id_ocurrencia"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_id_categoria_fkey";
            columns: ["id_categoria"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id_categoria"];
          },
          {
            foreignKeyName: "movimientos_id_ocurrencia_fkey";
            columns: ["id_ocurrencia"];
            isOneToOne: true;
            referencedRelation: "ocurrencias_recurrentes";
            referencedColumns: ["id_ocurrencia"];
          },
          {
            foreignKeyName: "movimientos_id_tipo_fkey";
            columns: ["id_tipo"];
            isOneToOne: false;
            referencedRelation: "tipos_movimiento";
            referencedColumns: ["id_tipo"];
          },
          {
            foreignKeyName: "movimientos_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "ocurrencias_recurrentes": {
        Row: {
          "id_ocurrencia": string;
          "id_recurrencia": string;
          "id_usuario": string;
          "fecha_programada": string;
          "fecha_prevista": string;
          "nombre": string;
          "id_tipo": number;
          "id_categoria": string | null;
          "monto_previsto": number;
          "estado": string;
          "automatica": boolean;
          "creada_en": string;
        };
        Insert: {
          "id_ocurrencia"?: string;
          "id_recurrencia": string;
          "id_usuario": string;
          "fecha_programada": string;
          "fecha_prevista": string;
          "nombre": string;
          "id_tipo": number;
          "id_categoria"?: string | null;
          "monto_previsto": number | DecimalString;
          "estado"?: string;
          "automatica"?: boolean;
          "creada_en"?: string;
        };
        Update: {
          "id_ocurrencia"?: string;
          "id_recurrencia"?: string;
          "id_usuario"?: string;
          "fecha_programada"?: string;
          "fecha_prevista"?: string;
          "nombre"?: string;
          "id_tipo"?: number;
          "id_categoria"?: string | null;
          "monto_previsto"?: number | DecimalString;
          "estado"?: string;
          "automatica"?: boolean;
          "creada_en"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocurrencias_recurrentes_id_categoria_fkey";
            columns: ["id_categoria"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id_categoria"];
          },
          {
            foreignKeyName: "ocurrencias_recurrentes_id_recurrencia_fkey";
            columns: ["id_recurrencia"];
            isOneToOne: false;
            referencedRelation: "config_recurrencias";
            referencedColumns: ["id_recurrencia"];
          },
          {
            foreignKeyName: "ocurrencias_recurrentes_id_tipo_fkey";
            columns: ["id_tipo"];
            isOneToOne: false;
            referencedRelation: "tipos_movimiento";
            referencedColumns: ["id_tipo"];
          },
          {
            foreignKeyName: "ocurrencias_recurrentes_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "presupuestos_mensuales": {
        Row: {
          "id_presupuesto": string;
          "id_usuario": string;
          "id_categoria": string | null;
          "monto_limite": number;
          "mes_calendario": number | null;
          "anio_calendario": number | null;
          "porcentaje_alerta": number | null;
        };
        Insert: {
          "id_presupuesto"?: string;
          "id_usuario": string;
          "id_categoria"?: string | null;
          "monto_limite": number | DecimalString;
          "mes_calendario"?: number | null;
          "anio_calendario"?: number | null;
          "porcentaje_alerta"?: number | null;
        };
        Update: {
          "id_presupuesto"?: string;
          "id_usuario"?: string;
          "id_categoria"?: string | null;
          "monto_limite"?: number | DecimalString;
          "mes_calendario"?: number | null;
          "anio_calendario"?: number | null;
          "porcentaje_alerta"?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "presupuestos_mensuales_id_categoria_fkey";
            columns: ["id_categoria"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id_categoria"];
          },
          {
            foreignKeyName: "presupuestos_mensuales_id_usuario_fkey";
            columns: ["id_usuario"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id_usuario"];
          },
        ];
      };
      "tipos_movimiento": {
        Row: {
          "id_tipo": number;
          "nombre_tipo": string;
          "descripcion": string | null;
          "signo_contable": number;
        };
        Insert: {
          "id_tipo"?: number;
          "nombre_tipo": string;
          "descripcion"?: string | null;
          "signo_contable": number;
        };
        Update: {
          "id_tipo"?: number;
          "nombre_tipo"?: string;
          "descripcion"?: string | null;
          "signo_contable"?: number;
        };
        Relationships: [
        ];
      };
      "usuarios": {
        Row: {
          "id_usuario": string;
          "nombre_completo": string;
          "username": string;
          "codigo_moneda": string | null;
          "url_avatar": string | null;
          "fecha_registro": string;
        };
        Insert: {
          "id_usuario": string;
          "nombre_completo": string;
          "username": string;
          "codigo_moneda"?: string | null;
          "url_avatar"?: string | null;
          "fecha_registro"?: string;
        };
        Update: {
          "id_usuario"?: string;
          "nombre_completo"?: string;
          "username"?: string;
          "codigo_moneda"?: string | null;
          "url_avatar"?: string | null;
          "fecha_registro"?: string;
        };
        Relationships: [
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      "actualizar_pendientes": {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      "archivar_meta": {
        Args: {
          "p_id": string | null;
          "p_archivada": boolean | null;
        };
        Returns: undefined;
      };
      "cambiar_ocurrencia": {
        Args: {
          "p_id": string | null;
          "p_accion": string | null;
          "p_fecha": string | null;
        };
        Returns: undefined;
      };
      "cambiar_recurrencia": {
        Args: {
          "p_id": string | null;
          "p_accion": string | null;
        };
        Returns: undefined;
      };
      "confirmar_ocurrencia": {
        Args: {
          "p_id": string | null;
          "p_monto": number | DecimalString | null;
          "p_fecha": string | null;
          "p_metodo": string | null;
        };
        Returns: string;
      };
      "guardar_meta": {
        Args: {
          "p_id": string | null;
          "p_nombre": string | null;
          "p_objetivo": number | DecimalString | null;
          "p_inicial": number | DecimalString | null;
          "p_fecha": string | null;
          "p_prioridad": string | null;
        };
        Returns: string;
      };
      "guardar_presupuesto": {
        Args: {
          "p_id": string | null;
          "p_categoria": string | null;
          "p_monto": number | DecimalString | null;
          "p_mes": number | null;
          "p_anio": number | null;
          "p_alerta": number | null;
        };
        Returns: string;
      };
      "guardar_recurrencia": {
        Args: {
          "p_id": string | null;
          "p_nombre": string | null;
          "p_tipo": number | null;
          "p_categoria": string | null;
          "p_monto": number | DecimalString | null;
          "p_frecuencia": string | null;
          "p_dia": number | null;
          "p_inicio": string | null;
          "p_fin": string | null;
          "p_automatica": boolean | null;
        };
        Returns: string;
      };
      "procesar_recurrencias": {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      "registrar_aporte_meta": {
        Args: {
          "p_id": string | null;
          "p_meta": string | null;
          "p_monto": number | DecimalString | null;
          "p_tipo": string | null;
          "p_fecha": string | null;
          "p_concepto": string | null;
        };
        Returns: string;
      };
      "revertir_aporte_meta": {
        Args: {
          "p_id": string | null;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
