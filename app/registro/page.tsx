"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase"; // Asegúrate de que la ruta sea correcta

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [moneda, setMoneda] = useState("USD");

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Registrar en Auth de Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) return alert(authError.message);

    // 2. Si el registro de auth fue exitoso, guardamos los datos en nuestra tabla 'usuarios'
    if (authData.user) {
      const { error: dbError } = await supabase.from("usuarios").insert([
        {
          id_usuario: authData.user.id,
          nombre_completo: nombre,
          username: username,
          codigo_moneda: moneda,
        },
      ]);

      if (dbError) {
        alert("Error al guardar perfil: " + dbError.message);
      } else {
        alert("¡Registro exitoso! Revisa tu correo para confirmar.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <form onSubmit={handleRegistro} className="flex flex-col gap-4 w-full max-w-md bg-white p-8 rounded shadow-md border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-4">Crea tu cuenta</h1>
        
        <input type="text" placeholder="Tu Apodo (Ej: Alex El Grande)" 
               onChange={(e) => setNombre(e.target.value)} className="border p-3 rounded bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        
        <input type="text" placeholder="Username (unico)" 
               onChange={(e) => setUsername(e.target.value)} className="border p-3 rounded bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required />

        <select onChange={(e) => setMoneda(e.target.value)} className="border p-3 rounded bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="USD">USD - Dólares</option>
          <option value="COP">COP - Pesos Colombianos</option>
          <option value="EUR">EUR - Euros</option>
        </select>

        <input type="email" placeholder="Email" 
               onChange={(e) => setEmail(e.target.value)} className="border p-3 rounded bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required />

        <input type="password" placeholder="Contraseña" 
               onChange={(e) => setPassword(e.target.value)} className="border p-3 rounded bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required />

        <button type="submit" className="bg-blue-600 text-white font-semibold p-3 mt-2 rounded hover:bg-blue-700 transition duration-200">
          Registrarme
        </button>
      </form>
    </div>
  );
}
