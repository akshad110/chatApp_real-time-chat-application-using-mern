import { useNavigate } from "react-router-dom";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../contexts/AuthContext";

export default function Logout({ modal, setModal }) {
  const navigate = useNavigate();
  const { logout, setError } = useAuth();

  async function handleLogout() {
    try {
      setError("");
      logout();
      setModal(false);
      navigate("/login");
    } catch {
      setError("Failed to logout");
    }
  }

  return (
    <Dialog open={modal} onClose={() => setModal(false)} className="relative z-10">
      <DialogBackdrop className="fixed inset-0 bg-gray-500/75" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-700 shadow-xl">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-gray-200 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <DialogTitle className="text-lg font-medium leading-6 text-gray-500 dark:text-gray-400">
                  Logging out
                </DialogTitle>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to log out?
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-500 shadow-sm hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white sm:mt-0 sm:w-auto sm:text-sm"
              onClick={() => setModal(false)}
            >
              Cancel
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
