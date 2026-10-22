// Generated from supabase/migrations by npm run db:types. Do not edit manually.
// This checks the versioned schema, not unversioned changes in Supabase Cloud.
export type DecimalString = `${number}`;
export type Database = {
  public: {
    Tables: {
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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
