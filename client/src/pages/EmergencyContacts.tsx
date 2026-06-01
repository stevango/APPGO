import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronLeft, Plus, Trash2, Star, Phone, Mail, Heart, AlertCircle, Loader2, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function EmergencyContacts() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    relationship: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sosData, setSosData] = useState<{ type: string; latitude?: string; longitude?: string; address?: string } | null>(null);

  const { data: contacts = [], isLoading, refetch } = trpc.emergencyContacts.list.useQuery();
  const { data: primaryContact } = trpc.emergencyContacts.getPrimary.useQuery();
  const createMutation = trpc.emergencyContacts.create.useMutation();
  const updateMutation = trpc.emergencyContacts.update.useMutation();
  const deleteMutation = trpc.emergencyContacts.delete.useMutation();
  const setPrimaryMutation = trpc.emergencyContacts.setPrimary.useMutation();
  const sendAlertMutation = trpc.emergencyContacts.sendAlert.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sosType = params.get("sosType");
    const latitude = params.get("latitude");
    const longitude = params.get("longitude");
    const address = params.get("address");

    if (sosType) {
      setSosData({
        type: sosType,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        address: address || undefined,
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success("Contato atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync({
          ...formData,
          isPrimary: contacts.length === 0,
        });
        toast.success("Contato adicionado com sucesso!");
      }

      setFormData({ name: "", phone: "", email: "", relationship: "" });
      setEditingId(null);
      setShowForm(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar contato");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar este contato?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Contato deletado com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao deletar contato");
    }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await setPrimaryMutation.mutateAsync({ id });
      toast.success("Contato definido como favorito!");
      refetch();
    } catch (error) {
      toast.error("Erro ao definir contato favorito");
    }
  };

  const handleEdit = (contact: any) => {
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      relationship: contact.relationship || "",
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleSendAlert = async (contactId: number) => {
    if (!sosData) {
      toast.error("Dados de SOS não disponíveis");
      return;
    }

    try {
      await sendAlertMutation.mutateAsync({
        contactId,
        sosType: sosData.type,
        latitude: sosData.latitude,
        longitude: sosData.longitude,
        address: sosData.address,
      });
      toast.success("Alerta enviado com sucesso!");
      setSosData(null);
      setTimeout(() => setLocation("/"), 1500);
    } catch (error) {
      toast.error("Erro ao enviar alerta");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Contatos de Emergência</h1>
          </div>
          {!sosData && (
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({ name: "", phone: "", email: "", relationship: "" });
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto max-w-2xl mx-auto w-full">
        {/* Info Banner */}
        <div className={`border rounded-xl p-4 mb-6 ${sosData ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${sosData ? "text-red-600" : "text-blue-600"}`} />
            <div>
              <h3 className={`font-semibold mb-1 ${sosData ? "text-red-900" : "text-blue-900"}`}>
                {sosData ? "Enviar Alerta de Emergência" : "Contatos Salvos"}
              </h3>
              <p className={`text-sm ${sosData ? "text-red-800" : "text-blue-800"}`}>
                {sosData 
                  ? "Selecione um contato para enviar o alerta de emergência instantaneamente." 
                  : "Adicione contatos de confiança para receber alertas de emergência."}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        {showForm && !sosData && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? "Editar Contato" : "Novo Contato"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Mãe, Pai, Amigo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (opcional)
                </label>
                <Input
                  type="email"
                  placeholder="contato@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relacionamento (opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Mãe, Pai, Cônjuge, Amigo"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingId ? "Atualizar" : "Adicionar"
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ name: "", phone: "", email: "", relationship: "" });
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Contacts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum contato adicionado</h3>
            <p className="text-sm text-gray-600 mb-6">
              Adicione seus contatos de confiança para receber alertas de emergência.
            </p>
            {!sosData && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Contato
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sosData && primaryContact && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900">{primaryContact.name}</h3>
                      <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-semibold">Favorito</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Enviar alerta para este contato?</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleSendAlert(primaryContact.id)}
                  disabled={sendAlertMutation.isPending}
                  className="w-full h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all active:scale-[0.97] duration-150"
                >
                  {sendAlertMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Alerta Agora
                    </>
                  )}
                </Button>
              </div>
            )}

            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`border-2 rounded-xl p-4 transition-all ${
                  contact.isPrimary
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900">{contact.name}</h3>
                      {contact.isPrimary && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>

                    {contact.relationship && (
                      <p className="text-xs text-gray-600 mb-2">{contact.relationship}</p>
                    )}

                    <div className="flex flex-col gap-1">
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {contact.phone}
                      </a>
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {sosData ? (
                      <button
                        onClick={() => handleSendAlert(contact.id)}
                        disabled={sendAlertMutation.isPending}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium"
                        title="Enviar alerta de emergência"
                      >
                        {sendAlertMutation.isPending ? "Enviando..." : "Enviar"}
                      </button>
                    ) : (
                      <>
                        {!contact.isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(contact.id)}
                            className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Definir como favorito"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
