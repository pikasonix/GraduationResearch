use crate::problem::pdptw::PDPTWInstance;

pub mod kdsp_writer;
pub mod li_lim_reader;
pub mod sartori_buriol_reader;
pub mod sintef_solution;

pub fn load_instance(
    path: impl Into<String> + Clone,
    max_vehicles: Option<usize>,
) -> anyhow::Result<PDPTWInstance> {
    load_instance_with_format(path, max_vehicles, "auto")
}

pub fn load_instance_with_format(
    path: impl Into<String> + Clone,
    max_vehicles: Option<usize>,
    format: &str,
) -> anyhow::Result<PDPTWInstance> {
    let path = path.into();
    
    match format {
        "lilim" => li_lim_reader::load_instance(path, max_vehicles),
        "sartori" => sartori_buriol_reader::load_instance(path, max_vehicles),
        "auto" | _ => {
            // Try Li&Lim first, then Sartori&Buriol
            li_lim_reader::load_instance(path.clone(), max_vehicles)
                .or_else(|_| sartori_buriol_reader::load_instance(path, max_vehicles))
        }
    }
}
