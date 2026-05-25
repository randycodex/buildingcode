import SwiftUI
import UIKit

/// Detects when the Search tab is tapped again while already selected.
struct TabBarReselectListener: UIViewControllerRepresentable {
    let onReselect: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onReselect: onReselect)
    }

    func makeUIViewController(context: Context) -> ListenerViewController {
        let controller = ListenerViewController()
        controller.coordinator = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: ListenerViewController, context: Context) {
        uiViewController.coordinator = context.coordinator
        uiViewController.attachIfNeeded()
    }

    final class Coordinator: NSObject, UITabBarControllerDelegate {
        let onReselect: () -> Void
        private weak var tabBarController: UITabBarController?
        private weak var listenerViewController: UIViewController?
        private weak var forwardedDelegate: UITabBarControllerDelegate?
        private var lastSelectedIndex: Int?

        init(onReselect: @escaping () -> Void) {
            self.onReselect = onReselect
        }

        func attach(to tabBarController: UITabBarController, listener: UIViewController) {
            self.tabBarController = tabBarController
            self.listenerViewController = listener

            if tabBarController.delegate !== self {
                // Guard against capturing a stale instance of ourselves as the
                // "forwarded" delegate during rapid mount/unmount cycles. Only
                // remember the existing delegate if it's something else.
                if !(tabBarController.delegate is Coordinator) {
                    forwardedDelegate = tabBarController.delegate
                }
                tabBarController.delegate = self
            }
            lastSelectedIndex = tabBarController.selectedIndex
        }

        func detachIfNeeded(from tabBarController: UITabBarController) {
            guard tabBarController.delegate === self else { return }
            tabBarController.delegate = forwardedDelegate
            forwardedDelegate = nil
        }

        func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
            if let forwardedDelegate,
               forwardedDelegate.responds(to: #selector(UITabBarControllerDelegate.tabBarController(_:shouldSelect:))) {
                return forwardedDelegate.tabBarController?(tabBarController, shouldSelect: viewController) ?? true
            }
            return true
        }

        func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
            let index = tabBarController.selectedIndex
            defer { lastSelectedIndex = index }

            if index == lastSelectedIndex,
               let listenerViewController,
               hosts(listenerViewController, in: viewController) {
                onReselect()
            }

            if let forwardedDelegate,
               forwardedDelegate.responds(to: #selector(UITabBarControllerDelegate.tabBarController(_:didSelect:))) {
                forwardedDelegate.tabBarController?(tabBarController, didSelect: viewController)
            }
        }

        private func hosts(_ listener: UIViewController, in root: UIViewController) -> Bool {
            if root === listener { return true }
            for child in root.children where hosts(listener, in: child) {
                return true
            }
            if let presented = root.presentedViewController, hosts(listener, in: presented) {
                return true
            }
            return false
        }
    }

    final class ListenerViewController: UIViewController {
        weak var coordinator: Coordinator?

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            attachIfNeeded()
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            if let coordinator, let tabBarController {
                coordinator.detachIfNeeded(from: tabBarController)
            }
        }

        func attachIfNeeded() {
            guard let coordinator, let tabBarController else { return }
            coordinator.attach(to: tabBarController, listener: self)
        }
    }
}
